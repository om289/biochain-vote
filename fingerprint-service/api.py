import os
import clr


class NBioBSP:
    """
    Python API for NITGEN HAMSTER 1
    using NITGEN.SDK.NBioBSP.dll written in .NET 3.5 64bit
    and NBioBSP.dll (main library)
    """

    def __init__(self):
        """
        Initializes .NET runtime and loads SDK DLL as Python library
        Required files:
            NITGEN.SDK.NBioBSP.dll
            NBioBSP.dll
        """
        sdk = os.path.join(os.path.dirname(__file__), "NITGEN.SDK.NBioBSP.dll")
        n_bio_api = os.path.join(os.path.dirname(__file__), "NBioBSP.dll")

        def error_text(file):
            return f"Required DLL file {file} not found"

        if not os.path.exists(sdk):
            raise FileNotFoundError(error_text(sdk))

        if not os.path.exists(n_bio_api):
            raise FileNotFoundError(error_text(n_bio_api))

        clr.AddReference(sdk)
        from NITGEN.SDK.NBioBSP import NBioAPI

        self.api = NBioAPI()

    def _handle_return(self, return_code):
        if return_code == 0:
            return True
        raise Exception(self.api.Error.GetErrorDescription(return_code))

    def _handle_device(self, do_open: bool = True, device_id: int = None):
        if not device_id:
            device_id = self.api.Type.DEVICE_ID.AUTO
        return self._handle_return(self.api.OpenDevice(device_id) if do_open else self.api.CloseDevice(device_id))

    def _verify_core(self, finger_1, finger_2=None):
        ret, is_same = self.api.VerifyMatch(finger_1, finger_2, bool(), self.api.Type.FIR_PAYLOAD()) if finger_2 else \
            self.api.Verify(finger_1, bool(), self.api.Type.FIR_PAYLOAD())
        if self._handle_return(ret):
            return is_same

    def open_device(self, device_id=None):
        """
        Opens device for communication, keep device_id as None to auto-detect the device
        :param device_id: short unsigned int
        :return: True
        """
        return self._handle_device(True, device_id)

    def close_device(self, device_id=None):
        """
        Closes opened device, keep device_id as None to auto-detect the device
        :param device_id: short unsigned int
        :return: True
        """
        return self._handle_device(False, device_id)

    def check_finger(self):
        """
        Checks if a finger is present on the device to scan
        :return: bool
        """
        ret, is_present = self.api.CheckFinger()
        if self._handle_return(ret):
            return is_present

    def capture(self):
        """
        Captures and returns fingerprint data
        :return: NBioAPI.Type.HFIR
        """
        ret, HFIR = self.api.Capture()
        if self._handle_return(ret):
            return HFIR

    def verify(self, finger):
        """
        Captures new fingerprint and matches it with stored fingerprint
        :param finger: NBioAPI.Type.HFIR
        :return: bool
        """
        return self._verify_core(finger)

    def match(self, finger, ref_finger):
        """
        Checks if finger matches with reference finger
        :param finger: NBioAPI.Type.HFIR
        :param ref_finger: NBioAPI.Type.HFIR
        :return: bool
        """
        return self._verify_core(finger, ref_finger)

    def hfir_to_fir_text_encode(self, finger, with_unicode=False, format=None):
        """
        Converts HFIR into text encoding
        :param finger: NBioBSP.Type.HFIR
        :return: NBioBSP.Type.FIR_TEXTENCODE
        """
        ret, fir_text_encode = self.api.GetTextFIRFromHandle(finger, self.api.Type.FIR_TEXTENCODE(), with_unicode,
                                                             (format or self.api.Type.FIR_FORMAT.STANDARD))
        if self._handle_return(ret):
            return fir_text_encode

    def str_to_fir_text_encode(self, text_encoding):
        """
        Converts text encoded fingerprint to HFIR
        :param text_encoding: NBioBSP.Type.FIR_TEXTENCODE
        :return: NBioBSP.Type.HFIR
        """
        temp = self.api.Type.FIR_TEXTENCODE()
        temp.TextFIR = text_encoding
        return temp


class NBioBSP_IndexSearch:

    def __init__(self, api: NBioBSP):
        self.api = api.api
        self.n_bio_bsp = api
        self.ins = self.api.IndexSearch(self.api)
        self.ins.InitEngine()

    def add_fir(self, captured_fir=None):
        if captured_fir is None:
            captured_fir = self.n_bio_bsp.capture()
        ret, data = self.ins.AddFIR(captured_fir, self.ins.GetDataCount()[1])
        if self.n_bio_bsp._handle_return(ret):
            return data
        return False

    def save_db(self, path=None):
        ret = self.ins.SaveDBToFile(path if path else "temp.db")
        if self.n_bio_bsp._handle_return(ret):
            return True
        return False

    def load_db(self, path):
        ret = self.ins.LoadDBFromFile(path)
        if self.n_bio_bsp._handle_return(ret):
            return True
        return False

    def clear_db(self):
        ret = self.ins.ClearDB()
        if self.n_bio_bsp._handle_return(ret):
            return True
        return False

    def identify_data(self, finger_handle):
        ret, data = self.ins.IdentifyData(finger_handle, 1, self.ins.FP_INFO(), self.ins.CALLBACK_INFO_0())
        if self.n_bio_bsp._handle_return(ret):
            return data
        return False
