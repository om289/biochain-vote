# -*- coding: utf-8 -*-
"""
NBioBSP Worker — fingerprint enroll/verify using the official .NET SDK.
Uses NITGEN.SDK.NBioBSP.dll (pythonnet) + NBioBSP.dll.

Usage:
  python nbio_worker.py --enroll
  python nbio_worker.py --verify <stored_text_fir>

Outputs a single JSON line to stdout:
  {"success": true, "template": "AQAAAB..."}   <- enroll
  {"success": true, "match": true/false}        <- verify
  {"success": false, "error": "..."}            <- failure
"""
import sys
import os
import json

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, THIS_DIR)

def emit(obj):
    print(json.dumps(obj), flush=True)


def run_enroll():
    try:
        from api import NBioBSP
        scanner = NBioBSP()
        scanner.open_device()

        # Capture live fingerprint — SDK shows its own scan dialog
        finger = scanner.capture()

        # Convert HFIR → text encoding for storage
        text_fir = scanner.hfir_to_fir_text_encode(finger)
        template = str(text_fir.TextFIR)

        scanner.close_device()
        emit({"success": True, "template": template})

    except Exception as e:
        emit({"success": False, "error": str(e)})


def run_verify(stored_template: str):
    try:
        import clr
        clr.AddReference(os.path.join(THIS_DIR, "NITGEN.SDK.NBioBSP.dll"))
        from NITGEN.SDK.NBioBSP import NBioAPI

        api = NBioAPI()

        ret = api.OpenDevice(api.Type.DEVICE_ID.AUTO)
        if ret != 0:
            emit({"success": False, "error": f"OpenDevice failed: code {ret}"})
            return

        # Build FIR_TEXTENCODE from stored template
        stored_fir = api.Type.FIR_TEXTENCODE()
        stored_fir.TextFIR = stored_template
        stored_fir.IsWideChar = False

        # SDK captures live finger and compares
        ret, is_matched = api.Verify(stored_fir, bool(), api.Type.FIR_PAYLOAD())

        api.CloseDevice(api.Type.DEVICE_ID.AUTO)

        if ret == 0:
            emit({"success": True, "match": bool(is_matched)})
        else:
            desc = api.Error.GetErrorDescription(ret)
            emit({"success": False, "error": f"Verify error: {desc} (code {ret})"})

    except Exception as e:
        emit({"success": False, "error": str(e)})


if __name__ == "__main__":
    if len(sys.argv) < 2:
        emit({"success": False, "error": "Usage: nbio_worker.py --enroll OR --verify <template>"})
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "--enroll":
        run_enroll()
    elif cmd == "--verify":
        if len(sys.argv) < 3:
            emit({"success": False, "error": "--verify requires a template string"})
            sys.exit(1)
        run_verify(sys.argv[2])
    else:
        emit({"success": False, "error": f"Unknown command: {cmd}"})
        sys.exit(1)
