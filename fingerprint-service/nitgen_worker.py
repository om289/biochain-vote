import ctypes
import json
import sys
import os
import tkinter as tk

def get_sdk():
    dll_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "NBioBSP.dll")
    sdk = ctypes.WinDLL(dll_path)
    sdk.FPD_PreInit.restype = ctypes.c_int32
    sdk.FPD_initGlobal.restype = ctypes.c_int32
    sdk.FPD_PreInit()
    sdk.FPD_initGlobal()
    return sdk

class TextFIR(ctypes.Structure):
    _fields_ = [('TextFIR', ctypes.c_char_p), ('IsWideChar', ctypes.c_bool)]
class InputFIR(ctypes.Structure):
    _fields_ = [('TextFIR', ctypes.c_char_p), ('IsWideChar', ctypes.c_bool)]

def run_enroll():
    sdk = get_sdk()
    sdk.NBioAPI_LP_Enroll.restype = ctypes.c_uint32
    sdk.NBioAPI_LP_Enroll.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint32)]
    sdk.NBioAPI_GetTextFIRFromHandle.restype = ctypes.c_uint32
    sdk.NBioAPI_GetTextFIRFromHandle.argtypes = [ctypes.c_uint32, ctypes.c_uint32, ctypes.POINTER(TextFIR), ctypes.c_bool]
    sdk.NBioAPI_FreeTextFIR.restype = ctypes.c_uint32
    sdk.NBioAPI_FreeFIRHandle.restype = ctypes.c_uint32

    root = tk.Tk()
    root.geometry("1x1+9999+9999") # move off screen
    root.overrideredirect(True)

    def do_action():
        fir = ctypes.c_uint32(0)
        # Passing None to both parameters like test_nitgen.py does
        ret = sdk.NBioAPI_LP_Enroll(None, None, ctypes.byref(fir))
        if ret == 1 and fir.value != 0:
            tfir = TextFIR()
            ret2 = sdk.NBioAPI_GetTextFIRFromHandle(0, fir.value, ctypes.byref(tfir), False)
            if ret2 == 1 and tfir.TextFIR:
                template = tfir.TextFIR.decode('ascii')
                print(json.dumps({"success": True, "template": template}))
                sdk.NBioAPI_FreeTextFIR(0, ctypes.byref(tfir))
            else:
                print(json.dumps({"success": False, "error": f"GetTextFIR failed hr={ret2}"}))
            sdk.NBioAPI_FreeFIRHandle(0, fir.value)
        else:
            print(json.dumps({"success": False, "error": f"Capture failed hr={ret}"}))
        
        root.quit()
        root.destroy()
        sys.exit(0)

    # Need to simulate a click flow so the window handles are settled
    root.after(200, do_action)
    root.mainloop()

def run_verify(template_str):
    sdk = get_sdk()
    sdk.NBioAPI_LP_Verify.restype = ctypes.c_uint32
    sdk.NBioAPI_LP_Verify.argtypes = [ctypes.POINTER(InputFIR), ctypes.c_void_p, ctypes.POINTER(ctypes.c_bool)]

    root = tk.Tk()
    root.geometry("1x1+9999+9999")
    root.overrideredirect(True)

    def do_action():
        stored = InputFIR()
        stored.TextFIR = template_str.encode('ascii')
        stored.IsWideChar = False
        
        matched = ctypes.c_bool(False)
        # Pass None as window handle like test_nitgen.py
        ret = sdk.NBioAPI_LP_Verify(ctypes.byref(stored), None, ctypes.byref(matched))
        
        if ret == 1:
            print(json.dumps({"success": True, "match": bool(matched.value)}))
        else:
            print(json.dumps({"success": False, "error": f"Verify failed hr={ret}"}))
            
        root.quit()
        root.destroy()
        sys.exit(0)

    root.after(200, do_action)
    root.mainloop()

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "enroll":
        run_enroll()
    elif len(sys.argv) > 2 and sys.argv[1] == "verify":
        run_verify(sys.argv[2])
    else:
        print(json.dumps({"success": False, "error": "Invalid args"}))
