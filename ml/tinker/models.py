"""List the base models this Tinker account can fine-tune (no key printed)."""

import common
import tinker

common.load_key()
caps = tinker.ServiceClient().get_server_capabilities()
for m in caps.supported_models:
    print(m)
