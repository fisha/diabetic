"""
Read-only access to the production companion: its system prompt, tool specs, argument models and the dose filter.
The harness evaluates exactly what `services/api` ships; it never patches or replaces it.
"""

import sys
from pathlib import Path

API = Path(__file__).resolve().parents[2] / "services" / "api"
if str(API) not in sys.path:
    sys.path.insert(0, str(API))

from steady_api.ai import context as prod_context
from steady_api.ai import tools as prod_tools
from steady_api.ai.prompt import system_prompt
from steady_api.ai.safety import reads_as_dose_instruction
from steady_api.clinical import GLUCOSE_ENTRY_MGDL_MAX, GLUCOSE_ENTRY_MGDL_MIN, MGDL_PER_MMOL, to_mgdl
from steady_api.models import DeviceLink, GlucoseRecord, Memory, Profile, Record, User

TOOL_SPECS = prod_tools.SPECS
MAX_TOOL_ROUNDS = 4  # mirrors steady_api.routers.conversation.MAX_TOOL_ROUNDS

__all__ = [
    "GLUCOSE_ENTRY_MGDL_MAX",
    "GLUCOSE_ENTRY_MGDL_MIN",
    "MAX_TOOL_ROUNDS",
    "MGDL_PER_MMOL",
    "TOOL_SPECS",
    "DeviceLink",
    "GlucoseRecord",
    "Memory",
    "Record",
    "User",
    "prod_context",
    "Profile",
    "prod_tools",
    "reads_as_dose_instruction",
    "system_prompt",
    "to_mgdl",
]
