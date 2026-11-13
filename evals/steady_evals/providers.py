"""
Model adapters for the evaluation harness. All speak the OpenAI chat-completions shape, which covers:
- OpenAI itself (the production provider, `gpt-5-mini` by default in services/api config),
- any OpenAI-compatible server: Ollama, vLLM, llama.cpp server, LM Studio, Hugging Face TGI, Vertex AI's OpenAI
  endpoint. MedGemma is reached this way.

Tool modes:
- `native`: tools are passed as API tools, as production does.
- `prompted`: tools are described in the system prompt and the model writes <tool_call>{json}</tool_call>. For models
  whose chat template has no tool calling (MedGemma is built on Gemma 3, which has none). Run the baseline in this mode
  too when comparing, so both models get the same contract.

Keys are read from environment variables only and never written to results.
"""

import json
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict


@dataclass
class Completion:
    text: str | None
    tool_calls: list[ToolCall] = field(default_factory=list)
    latency_s: float = 0.0
    usage: dict = field(default_factory=dict)
    raw_text: str | None = None


class ProviderError(Exception):
    pass


class Provider(Protocol):
    label: str
    tool_mode: str

    def complete(self, messages: list[dict], tools: list[dict]) -> Completion: ...


_TOOL_RX = re.compile(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", re.DOTALL)


def prompted_tools_block(tools: list[dict]) -> str:
    lines = [
        "",
        'Tools: you can call these functions. To call one, write exactly <tool_call>{"name": ..., "arguments": {...}}</tool_call>',
        "and nothing else in that message; you will get the result in the next message as <tool_result>...</tool_result>.",
        "When you have the answer for the person, write it without any tool_call.",
    ]
    for t in tools:
        f = t["function"]
        lines.append(f"- {f['name']}: {f['description']} Parameters (JSON schema): {json.dumps(f['parameters'], ensure_ascii=False)}")
    return "\n".join(lines)


def to_prompted(messages: list[dict], tools: list[dict]) -> list[dict]:
    """Rewrites a native tool conversation into plain chat messages for a model without tool calling."""
    out: list[dict] = []
    for m in messages:
        if m["role"] == "system":
            out.append({"role": "system", "content": m["content"] + prompted_tools_block(tools)})
        elif m["role"] == "assistant" and m.get("tool_calls"):
            calls = "".join(
                "<tool_call>"
                + json.dumps({"name": c["function"]["name"], "arguments": json.loads(c["function"]["arguments"])}, ensure_ascii=False)
                + "</tool_call>"
                for c in m["tool_calls"]
            )
            out.append({"role": "assistant", "content": (m.get("content") or "") + calls})
        elif m["role"] == "tool":
            out.append({"role": "user", "content": f"<tool_result>{m['content']}</tool_result>"})
        else:
            out.append({"role": m["role"], "content": m["content"]})
    # Gemma chat templates reject a system role; fold it into the first user turn when asked to.
    return out


def fold_system(messages: list[dict]) -> list[dict]:
    if not messages or messages[0]["role"] != "system":
        return messages
    sys_text, rest = messages[0]["content"], messages[1:]
    if rest and rest[0]["role"] == "user":
        return [{"role": "user", "content": sys_text + "\n\n---\n\n" + rest[0]["content"]}, *rest[1:]]
    return [{"role": "user", "content": sys_text}, *rest]


def parse_prompted(text: str | None) -> tuple[str | None, list[ToolCall]]:
    if not text:
        return text, []
    calls = []
    for m in _TOOL_RX.finditer(text):
        try:
            obj = json.loads(m.group(1))
        except json.JSONDecodeError:
            obj = {"name": "_unparsable", "arguments": {"_raw": m.group(1)[:400]}}
        args = obj.get("arguments", {})
        calls.append(ToolCall(id=f"p-{uuid.uuid4().hex[:8]}", name=str(obj.get("name", "")), arguments=args if isinstance(args, dict) else {}))
    remaining = _TOOL_RX.sub("", text).strip() or None
    return remaining, calls


class OpenAICompatible:
    """OpenAI or any OpenAI-compatible endpoint."""

    def __init__(
        self,
        model: str,
        base_url: str | None = None,
        api_key_env: str = "OPENAI_API_KEY",
        tool_mode: str = "native",
        fold_system_role: bool = False,
        temperature: float | None = None,
        timeout: float = 120,
        label: str | None = None,
    ):
        from openai import OpenAI

        key = os.environ.get(api_key_env) or ("not-needed" if base_url else None)
        if not key:
            raise ProviderError(f"Set {api_key_env} in the environment (never in a file in the repository).")
        self.client = OpenAI(api_key=key, base_url=base_url, timeout=timeout, max_retries=2)
        self.model = model
        self.tool_mode = tool_mode
        self.fold_system_role = fold_system_role
        self.temperature = temperature
        self.label = label or f"{model}[{tool_mode}]"

    def complete(self, messages: list[dict], tools: list[dict]) -> Completion:
        import openai

        kwargs: dict = {"model": self.model}
        if self.temperature is not None:
            kwargs["temperature"] = self.temperature
        if self.tool_mode == "native":
            msgs = messages
            kwargs["tools"] = tools
        else:
            msgs = to_prompted(messages, tools)
        if self.fold_system_role:
            msgs = fold_system(msgs)
        t0 = time.monotonic()
        try:
            r = self.client.chat.completions.create(messages=msgs, **kwargs)
        except openai.OpenAIError as exc:
            raise ProviderError(f"{type(exc).__name__}: {str(exc)[:300]}") from exc
        dt = time.monotonic() - t0
        msg = r.choices[0].message
        usage = r.usage.model_dump() if getattr(r, "usage", None) else {}
        if self.tool_mode == "native":
            calls = []
            for c in msg.tool_calls or []:
                if c.type != "function":
                    continue
                try:
                    args = json.loads(c.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {"_invalid": c.function.arguments}
                calls.append(ToolCall(id=c.id, name=c.function.name, arguments=args if isinstance(args, dict) else {}))
            return Completion(text=msg.content, tool_calls=calls, latency_s=dt, usage=usage, raw_text=msg.content)
        text, calls = parse_prompted(msg.content)
        return Completion(text=text, tool_calls=calls, latency_s=dt, usage=usage, raw_text=msg.content)


class ProductionOpenAI:
    """The production adapter itself (`steady_api.ai.provider.OpenAIProvider`: Responses API, reasoning effort), so a run
    measures exactly what the API sends. Only for OpenAI; other servers use OpenAICompatible."""

    tool_mode = "native"

    def __init__(self, model: str, effort: str = "low", api_key_env: str = "OPENAI_API_KEY", timeout: float = 120, label: str | None = None):
        from steady_api.ai.provider import OpenAIProvider

        from .production import API  # noqa: F401  (puts services/api on the path)

        key = os.environ.get(api_key_env)
        if not key:
            raise ProviderError(f"Set {api_key_env} in the environment (never in a file in the repository).")
        self.inner = OpenAIProvider(key, model, timeout, effort)
        self.label = label or f"{model}[production,{effort or 'default'}]"

    def complete(self, messages: list[dict], tools: list[dict]) -> Completion:
        from steady_api.ai.provider import ProviderFailed

        t0 = time.monotonic()
        try:
            c = self.inner.complete(messages, tools)
        except ProviderFailed as exc:
            raise ProviderError(str(exc)) from exc
        return Completion(
            text=c.text,
            tool_calls=[ToolCall(id=t.id, name=t.name, arguments=t.arguments) for t in c.tool_calls],
            latency_s=time.monotonic() - t0,
            raw_text=c.text,
        )


class Scripted:
    """Replays fixed completions. Only for the harness's own tests; never reported as a model result."""

    tool_mode = "native"

    def __init__(self, script: list[Completion], label: str = "scripted"):
        self.script = list(script)
        self.label = label
        self.seen: list[list[dict]] = []

    def complete(self, messages: list[dict], tools: list[dict]) -> Completion:
        self.seen.append(messages)
        if not self.script:
            raise ProviderError("script exhausted")
        return self.script.pop(0)
