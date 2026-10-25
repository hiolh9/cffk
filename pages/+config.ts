import type { Config } from "vike/types";
import vikeVue from "vike-vue/config";

const config: Config = {
  title: "CFFK-Shop",
  description: "",
  passToClient: ["user", "site", "rootInitialized", "registrationEnabled", "urlLocale"],
  headers: ["cookie", "cf-ipcountry", "x-storefront-locale"],
  extends: [vikeVue],
};

export default config;
