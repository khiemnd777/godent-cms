import { expect, it } from "bun:test";
import { primaryPublicUrl } from "./primary-url";
it("projects admin links from current server primary and explicit tenant identity", () => {
  expect(primaryPublicUrl({ mode:"godent",bindingId:null,version:0,origin:"http://localhost:5892",basePath:"/clinic-a" },"clinic-a","en","service","care")).toBe("http://localhost:5892/clinic-a/en/dich-vu/care");
  expect(primaryPublicUrl({ mode:"custom",bindingId:"binding",version:3,origin:"http://clinic-a.test:5892",basePath:"" },"clinic-a","en","service","care")).toBe("http://clinic-a.test:5892/en/dich-vu/care");
  expect(primaryPublicUrl({ mode:"custom",bindingId:"binding",version:3,origin:"http://clinic-a.test:5892",basePath:"" },"clinic-a","vi","home")).toBe("http://clinic-a.test:5892/");
});
