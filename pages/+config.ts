import type { Config } from "vike/types";
import vikeVue from "vike-vue/config";

const config: Config = {
  title: "CFFK-Shop",
  description: "",
  passToClient: ["user", "site", "rootInitialized", "registrationEnabled"],
  // Needed so data() can read Cookie / CF-IPCountry for currency preference
  headers: ["cookie", "cf-ipcountry"],
  extends: [vikeVue],
};

export default config;
