"""
NITGEN fingerprint test — runs NBioAPI_LP_Enroll with a real window handle.
A small dialog pops up for fingerprint scan.
"""
import ctypes
import tkinter as tk
from tkinter import messagebox
import os
import sys
import json

# ── Parse CLI args first so is_auto/auto_mode are available everywhere ────────
is_auto = False
auto_mode = None
auto_template = None
enrolled_template = None

if len(sys.argv) > 1:
    if sys.argv[1] == "--auto-enroll":
        is_auto = True
        auto_mode = "enroll"
    elif sys.argv[1] == "--auto-verify" and len(sys.argv) > 2:
        is_auto = True
        auto_mode = "verify"
        auto_template = sys.argv[2]
        enrolled_template = auto_template

# ── Load DLL ──────────────────────────────────────────────────────────────────
dll_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "NBioBSP.dll")

try:
    sdk = ctypes.WinDLL(dll_path)
except OSError as e:
    if is_auto:
        print(json.dumps({"success": False, "error": f"DLL load failed: {e}"}))
    sys.exit(1)

NBIO_OK = 1

# Init FPD engine
sdk.FPD_PreInit.restype = ctypes.c_int32
sdk.FPD_initGlobal.restype = ctypes.c_int32
sdk.FPD_PreInit()
sdk.FPD_initGlobal()

# Setup function signatures
sdk.NBioAPI_LP_Enroll.restype = ctypes.c_uint32
sdk.NBioAPI_LP_Enroll.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint32)]

sdk.NBioAPI_LP_Verify.restype = ctypes.c_uint32
sdk.NBioAPI_LP_Verify.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.POINTER(ctypes.c_bool)]

class TextFIR(ctypes.Structure):
    _fields_ = [('TextFIR', ctypes.c_char_p), ('IsWideChar', ctypes.c_bool)]

sdk.NBioAPI_GetTextFIRFromHandle.restype = ctypes.c_uint32
sdk.NBioAPI_GetTextFIRFromHandle.argtypes = [ctypes.c_uint32, ctypes.c_uint32, ctypes.POINTER(TextFIR), ctypes.c_bool]

sdk.NBioAPI_FreeFIRHandle.restype = ctypes.c_uint32
sdk.NBioAPI_FreeFIRHandle.argtypes = [ctypes.c_uint32, ctypes.c_uint32]

sdk.NBioAPI_FreeTextFIR.restype = ctypes.c_uint32
sdk.NBioAPI_FreeTextFIR.argtypes = [ctypes.c_uint32, ctypes.POINTER(TextFIR)]

# ── Tkinter root (needed for SDK GUI even in auto mode) ───────────────────────
root = tk.Tk()


def do_enroll():
    global enrolled_template
    fir = ctypes.c_uint32(0)
    # Pass the real Win32 HWND so the SDK can attach its capture dialog properly.
    # Passing NULL (None) causes hr=0x1 with fir=0 — SDK needs a valid parent window.
    hwnd = ctypes.c_void_p(root.winfo_id())
    ret = sdk.NBioAPI_LP_Enroll(hwnd, None, ctypes.byref(fir))
    if ret == NBIO_OK and fir.value != 0:
        tfir = TextFIR()
        ret2 = sdk.NBioAPI_GetTextFIRFromHandle(0, fir.value, ctypes.byref(tfir), False)
        if ret2 == NBIO_OK and tfir.TextFIR:
            enrolled_template = tfir.TextFIR.decode('ascii')
            if is_auto:
                print(json.dumps({"success": True, "template": enrolled_template}))
            else:
                lbl.config(text=f"✓ Enrolled! Template: {enrolled_template[:40]}...")
                print(f"Template: {enrolled_template[:80]}...")
            sdk.NBioAPI_FreeTextFIR(0, ctypes.byref(tfir))
        else:
            if is_auto:
                print(json.dumps({"success": False, "error": f"GetTextFIR failed hr=0x{ret2:08X}"}))
            else:
                lbl.config(text="Enrolled but could not extract template")
        sdk.NBioAPI_FreeFIRHandle(0, fir.value)
    else:
        if is_auto:
            print(json.dumps({"success": False, "error": f"Capture failed hr=0x{ret:08X}"}))
        else:
            lbl.config(text=f"Enroll failed: 0x{ret:08X}")

    if is_auto:
        root.quit()
        root.destroy()
        sys.exit(0)


def do_verify():
    if not enrolled_template:
        if is_auto:
            print(json.dumps({"success": False, "error": "No template"}))
            sys.exit(0)
        else:
            messagebox.showwarning("Warning", "Enroll first!")
            return

    class InputFIR(ctypes.Structure):
        _fields_ = [('TextFIR', ctypes.c_char_p), ('IsWideChar', ctypes.c_bool)]

    stored = InputFIR()
    stored.TextFIR = enrolled_template.encode('ascii')
    stored.IsWideChar = False

    sdk.NBioAPI_LP_Verify.argtypes = [ctypes.POINTER(InputFIR), ctypes.c_void_p, ctypes.POINTER(ctypes.c_bool)]
    matched = ctypes.c_bool(False)
    hwnd = ctypes.c_void_p(root.winfo_id())
    ret = sdk.NBioAPI_LP_Verify(ctypes.byref(stored), hwnd, ctypes.byref(matched))
    if ret == NBIO_OK:
        if is_auto:
            print(json.dumps({"success": True, "match": bool(matched.value)}))
        else:
            lbl.config(text=f"Match: {'YES ✓' if matched.value else 'NO ✗'}")
    else:
        if is_auto:
            print(json.dumps({"success": False, "error": f"Verify failed hr=0x{ret:08X}"}))
        else:
            lbl.config(text=f"Verify failed: 0x{ret:08X}")

    if is_auto:
        root.quit()
        root.destroy()
        sys.exit(0)


# ── Entry point ───────────────────────────────────────────────────────────────
if is_auto:
    root.title("Scanning - Do not close")
    root.geometry("250x100+500+500")

    lbl = tk.Label(root, text="Please touch the fingerprint scanner...")
    lbl.pack(pady=20)
    root.update()

    def auto_action():
        if auto_mode == "enroll":
            do_enroll()
        else:
            do_verify()

    root.after(500, auto_action)
    root.mainloop()

else:
    # Standard Interactive GUI
    root.title("NITGEN Test")
    root.geometry("400x200")
    tk.Label(root, text="NITGEN Fingerprint Scanner Test", font=("Arial", 14, "bold")).pack(pady=10)
    lbl = tk.Label(root, text="Press Enroll to scan fingerprint", font=("Arial", 10), wraplength=350)
    lbl.pack(pady=10)

    btn_frame = tk.Frame(root)
    btn_frame.pack()
    tk.Button(btn_frame, text="Enroll", command=do_enroll, bg='#4CAF50', fg='white', padx=10, pady=5).pack(side='left', padx=5)
    tk.Button(btn_frame, text="Verify", command=do_verify, bg='#2196F3', fg='white', padx=10, pady=5).pack(side='left', padx=5)
    root.mainloop()
