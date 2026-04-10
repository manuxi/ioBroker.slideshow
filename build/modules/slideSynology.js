"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var slideSynology_exports = {};
__export(slideSynology_exports, {
  getPicture: () => getPicture,
  getPicturePrefetch: () => getPicturePrefetch,
  updatePictureList: () => updatePictureList
});
module.exports = __toCommonJS(slideSynology_exports);
var import_axios = __toESM(require("axios"));
var import_axios_cookiejar_support = require("axios-cookiejar-support");
var import_tough_cookie = require("tough-cookie");
var path = __toESM(require("path"));
const synoFolders = [];
let synoConnectionState = false;
let synoToken = "";
const AxiosJar = new import_tough_cookie.CookieJar();
const synoConnection = (0, import_axios_cookiejar_support.wrapper)(import_axios.default.create({ withCredentials: true, jar: AxiosJar }));
let CurrentImages;
let CurrentImage;
let CurrentPicture;
function getBaseUrl(synoPath) {
  if (synoPath.startsWith("http://") || synoPath.startsWith("https://")) {
    return synoPath.replace(/\/+$/, "");
  }
  return `http://${synoPath}`;
}
function synoTimestampToDate(time) {
  if (time > 1e12) {
    return new Date(time);
  }
  return new Date(time * 1e3);
}
async function getPicture(Helper) {
  try {
    if (!CurrentPicture) {
      await getPicturePrefetch(Helper);
    }
    const CurrentPictureResult = CurrentPicture;
    getPicturePrefetch(Helper);
    return CurrentPictureResult;
  } catch (err) {
    Helper.ReportingError(err, "Unknown Error", "Synology", "getPicture");
    return null;
  }
}
async function getPicturePrefetch(Helper) {
  var _a;
  try {
    if (CurrentImages.length !== 0) {
      if (!CurrentImage) {
        CurrentImage = CurrentImages[0];
      } else {
        if (CurrentImages.indexOf(CurrentImage) === CurrentImages.length - 1) {
          CurrentImage = CurrentImages[0];
        } else {
          CurrentImage = CurrentImages[CurrentImages.indexOf(CurrentImage) + 1];
        }
      }
    }
  } catch (err) {
    Helper.ReportingError(err, "Unknown Error", "Synology", "getPicturePrefetch/Select");
  }
  try {
    await loginSyno(Helper);
    const baseUrl = getBaseUrl(Helper.Adapter.config.syno_path);
    let synURL = "";
    if (Helper.Adapter.config.syno_version === 0) {
      const apiNs = CurrentImage.apiNamespace || "SYNO.FotoTeam";
      synURL = `${baseUrl}/photo/webapi/entry.cgi?api=${apiNs}.Download&method=download&version=1&unit_id=%5B${CurrentImage.path}%5D&force_download=true&SynoToken=${synoToken}`;
    } else {
      synURL = `${baseUrl}/photo/webapi/download.php?api=SYNO.PhotoStation.Download&method=getphoto&version=1&id=${CurrentImage.path}&download=true`;
    }
    Helper.ReportingInfo("Debug", "Synology", `Downloading picture ${CurrentImage.info3} (ID ${CurrentImage.path})`);
    const synResult = await synoConnection.get(synURL, { responseType: "arraybuffer" });
    const PicContentB64 = synResult.data.toString("base64");
    CurrentPicture = { ...CurrentImage, url: `data:image/jpeg;base64,${PicContentB64}` };
  } catch (err) {
    if (((_a = err.response) == null ? void 0 : _a.status) === 502) {
      Helper.ReportingError(err, `Unknown Error downloading Picture ${CurrentImage.path}`, "Synology", "getPicturePrefetch/Retrieve", "", false);
    } else {
      Helper.ReportingError(err, "Unknown Error", "Synology", "getPicturePrefetch/Retrieve");
    }
  }
}
async function updatePictureList(Helper) {
  var _a;
  CurrentImages = [];
  await loginSyno(Helper);
  if (synoConnectionState !== true) {
    return { success: false, picturecount: 0 };
  }
  const CurrentImageList = [];
  try {
    if (Helper.Adapter.config.syno_version === 0) {
      const albumName = (_a = Helper.Adapter.config.syno_album) == null ? void 0 : _a.trim();
      if (albumName) {
        await getDsm7AlbumItems(Helper, albumName, CurrentImageList);
      } else {
        await getDsm7FolderItems(Helper, CurrentImageList);
      }
    } else {
      await getDsm6Items(Helper, CurrentImageList);
    }
    Helper.ReportingInfo("Debug", "Synology", `${CurrentImageList.length} pictures found before filtering`);
  } catch (err) {
    Helper.ReportingError(err, "Unknown Error", "Synology", "updatePictureList/List");
    return { success: false, picturecount: 0 };
  }
  try {
    const CurrentImageListFilter1 = CurrentImageList.filter(function(element) {
      const ext = path.extname(element.info3).toLowerCase();
      return ext === ".jpg" || ext === ".jpeg" || ext === ".png";
    });
    if (Helper.Adapter.config.syno_format > 0) {
      CurrentImageListFilter1.filter(function(element) {
        if ((Helper.Adapter.config.syno_format === 1 && element.x > element.y) === true) {
          if (Array.isArray(CurrentImages)) {
            CurrentImages.push(element);
          } else {
            CurrentImages = [element];
          }
        }
        if ((Helper.Adapter.config.syno_format === 2 && element.y > element.x) === true) {
          if (Array.isArray(CurrentImages)) {
            CurrentImages.push(element);
          } else {
            CurrentImages = [element];
          }
        }
      });
    } else {
      CurrentImages = CurrentImageListFilter1;
    }
    switch (Helper.Adapter.config.syno_order) {
      case 0:
        CurrentImages = await sortByKey(CurrentImages, "date");
        break;
      case 1:
        CurrentImages = await sortByKey(CurrentImages, "info3");
        break;
      case 3:
        let currentIndex = CurrentImages.length, temporaryValue, randomIndex;
        while (0 !== currentIndex) {
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex -= 1;
          temporaryValue = CurrentImages[currentIndex];
          CurrentImages[currentIndex] = CurrentImages[randomIndex];
          CurrentImages[randomIndex] = temporaryValue;
        }
    }
  } catch (err) {
    Helper.ReportingError(err, "Unknown Error", "Synology", "updatePictureList/Filter");
    return { success: false, picturecount: 0 };
  }
  if (!(CurrentImages.length > 0)) {
    Helper.ReportingError(null, "No pictures found", "Synology", "updatePictureList", "", false);
    return { success: false, picturecount: 0 };
  } else {
    Helper.ReportingInfo("Info", "Synology", `${CurrentImages.length} pictures found`, { JSON: JSON.stringify(CurrentImages.slice(0, 99)) });
    return { success: true, picturecount: CurrentImages.length };
  }
}
async function getDsm7AlbumItems(Helper, albumName, imageList) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v;
  const baseUrl = getBaseUrl(Helper.Adapter.config.syno_path);
  const apiUrl = `${baseUrl}/photo/webapi/entry.cgi`;
  for (const apiNs of ["SYNO.FotoTeam", "SYNO.Foto"]) {
    const spaceName = apiNs === "SYNO.FotoTeam" ? "Shared Space" : "Personal Space";
    Helper.ReportingInfo("Debug", "Synology", `Searching for album "${albumName}" in ${spaceName}`);
    let albumId = null;
    let offset = 0;
    while (albumId === null) {
      let synResult;
      try {
        synResult = await synoConnection.get(apiUrl, {
          params: {
            api: `${apiNs}.Browse.Album`,
            method: "list",
            version: 2,
            offset,
            limit: 100,
            SynoToken: synoToken
          }
        });
      } catch (err) {
        Helper.ReportingInfo("Debug", "Synology", `Could not list albums in ${spaceName}: ${err.message}`);
        break;
      }
      if (((_a = synResult.data) == null ? void 0 : _a.success) !== true || !Array.isArray((_c = (_b = synResult.data) == null ? void 0 : _b.data) == null ? void 0 : _c.list)) {
        Helper.ReportingInfo("Debug", "Synology", `No albums accessible in ${spaceName}: ${JSON.stringify(synResult.data)}`);
        break;
      }
      const albums = synResult.data.data.list;
      if (albums.length === 0)
        break;
      Helper.ReportingInfo("Debug", "Synology", `${spaceName}: found ${albums.length} albums at offset ${offset}: ${albums.map((a) => a.name).join(", ")}`);
      const found = albums.find((a) => a.name === albumName);
      if (found) {
        albumId = found.id;
        Helper.ReportingInfo("Info", "Synology", `Found album "${albumName}" (ID: ${albumId}) in ${spaceName}`);
        break;
      }
      offset += 100;
    }
    if (albumId === null)
      continue;
    let itemOffset = 0;
    while (true) {
      const synResult = await synoConnection.get(apiUrl, {
        params: {
          api: `${apiNs}.Browse.Item`,
          method: "list",
          version: 1,
          album_id: albumId,
          offset: itemOffset,
          limit: 500,
          additional: JSON.stringify(["description", "resolution", "orientation", "tag"]),
          SynoToken: synoToken
        }
      });
      if (((_d = synResult.data) == null ? void 0 : _d.success) !== true || !Array.isArray((_f = (_e = synResult.data) == null ? void 0 : _e.data) == null ? void 0 : _f.list)) {
        Helper.ReportingError(null, `Error getting pictures from album "${albumName}"`, "Synology", "getDsm7AlbumItems", JSON.stringify(synResult.data), false);
        return;
      }
      const items = synResult.data.data.list;
      if (items.length === 0)
        break;
      Helper.ReportingInfo("Debug", "Synology", `Album "${albumName}": ${items.length} items at offset ${itemOffset}`);
      for (const element of items) {
        let PictureDate = null;
        if (element.time) {
          PictureDate = synoTimestampToDate(element.time);
        }
        imageList.push({
          path: String(element.id),
          url: "",
          info1: element.description || "",
          info2: "",
          info3: element.filename || "",
          date: PictureDate,
          x: ((_h = (_g = element.additional) == null ? void 0 : _g.resolution) == null ? void 0 : _h.height) || 0,
          y: ((_j = (_i = element.additional) == null ? void 0 : _i.resolution) == null ? void 0 : _j.width) || 0,
          apiNamespace: apiNs
        });
      }
      itemOffset += 500;
    }
    return;
  }
  Helper.ReportingInfo("Debug", "Synology", `Searching for album "${albumName}" in Shared-with-me albums`);
  const sharedApiVariants = [
    { api: "SYNO.Foto.Browse.Album", method: "list", version: 2, extra: { category: "shared_with_me" } },
    { api: "SYNO.Foto.Browse.Album", method: "list_shared_with_me", version: 2, extra: {} },
    { api: "SYNO.Foto.Sharing.Misc", method: "list_shared_with_me", version: 1, extra: {} }
  ];
  for (const variant of sharedApiVariants) {
    const variantLabel = `${variant.api}/${variant.method}(v${variant.version})`;
    let sharedAlbumId = null;
    let sharedPassphrase = "";
    let sharedOffset = 0;
    let variantWorked = false;
    while (sharedAlbumId === null) {
      let synResult;
      try {
        synResult = await synoConnection.get(apiUrl, {
          params: {
            api: variant.api,
            method: variant.method,
            version: variant.version,
            offset: sharedOffset,
            limit: 100,
            SynoToken: synoToken,
            ...variant.extra
          }
        });
      } catch (err) {
        Helper.ReportingInfo("Debug", "Synology", `${variantLabel}: request failed: ${err.message}`);
        break;
      }
      if (((_k = synResult.data) == null ? void 0 : _k.success) !== true || !Array.isArray((_m = (_l = synResult.data) == null ? void 0 : _l.data) == null ? void 0 : _m.list)) {
        Helper.ReportingInfo("Debug", "Synology", `${variantLabel}: not available (${JSON.stringify(synResult.data)})`);
        break;
      }
      variantWorked = true;
      const sharedAlbums = synResult.data.data.list;
      if (sharedAlbums.length === 0)
        break;
      const albumNames = sharedAlbums.map((a) => {
        var _a2;
        return ((_a2 = a.album) == null ? void 0 : _a2.name) || a.name || "?";
      }).join(", ");
      Helper.ReportingInfo("Debug", "Synology", `${variantLabel}: found ${sharedAlbums.length} albums at offset ${sharedOffset}: ${albumNames}`);
      for (const entry of sharedAlbums) {
        const name = ((_n = entry.album) == null ? void 0 : _n.name) || entry.name;
        if (name === albumName) {
          sharedAlbumId = ((_o = entry.album) == null ? void 0 : _o.id) || entry.id;
          sharedPassphrase = entry.passphrase || "";
          Helper.ReportingInfo("Info", "Synology", `Found album "${albumName}" (ID: ${sharedAlbumId}) via ${variantLabel}`);
          break;
        }
      }
      sharedOffset += 100;
    }
    if (sharedAlbumId !== null) {
      let itemOffset = 0;
      while (true) {
        const params = {
          api: "SYNO.Foto.Browse.Item",
          method: "list",
          version: 1,
          album_id: sharedAlbumId,
          offset: itemOffset,
          limit: 500,
          additional: JSON.stringify(["description", "resolution", "orientation", "tag"]),
          SynoToken: synoToken
        };
        if (sharedPassphrase) {
          params.passphrase = sharedPassphrase;
        }
        const synResult = await synoConnection.get(apiUrl, { params });
        if (((_p = synResult.data) == null ? void 0 : _p.success) !== true || !Array.isArray((_r = (_q = synResult.data) == null ? void 0 : _q.data) == null ? void 0 : _r.list)) {
          Helper.ReportingError(null, `Error getting pictures from shared album "${albumName}"`, "Synology", "getDsm7AlbumItems/Shared", JSON.stringify(synResult.data), false);
          return;
        }
        const items = synResult.data.data.list;
        if (items.length === 0)
          break;
        Helper.ReportingInfo("Debug", "Synology", `Shared album "${albumName}": ${items.length} items at offset ${itemOffset}`);
        for (const element of items) {
          let PictureDate = null;
          if (element.time) {
            PictureDate = synoTimestampToDate(element.time);
          }
          imageList.push({
            path: String(element.id),
            url: "",
            info1: element.description || "",
            info2: "",
            info3: element.filename || "",
            date: PictureDate,
            x: ((_t = (_s = element.additional) == null ? void 0 : _s.resolution) == null ? void 0 : _t.height) || 0,
            y: ((_v = (_u = element.additional) == null ? void 0 : _u.resolution) == null ? void 0 : _v.width) || 0,
            apiNamespace: "SYNO.Foto"
          });
        }
        itemOffset += 500;
      }
      return;
    }
    if (variantWorked)
      break;
  }
  Helper.ReportingError(null, `Album "${albumName}" not found in Shared Space, Personal Space, or Shared-with-me`, "Synology", "getDsm7AlbumItems", "", false);
}
async function getDsm7FolderItems(Helper, imageList) {
  const baseUrl = getBaseUrl(Helper.Adapter.config.syno_path);
  Helper.ReportingInfo("Debug", "Synology", "Start iterating folders (no album configured)");
  synoFolders.length = 0;
  await synoGetFolders(Helper, 1);
  Helper.ReportingInfo("Debug", "Synology", `${synoFolders.length} folders found, receiving pictures`);
  for (const synoFolder of synoFolders) {
    Helper.ReportingInfo("Debug", "Synology", `Getting pictures of folder ID ${synoFolder.id} (${synoFolder.name})`);
    let synEndOfFiles = false;
    let synOffset = 0;
    while (synEndOfFiles === false) {
      const synURL = `${baseUrl}/photo/webapi/entry.cgi?api=SYNO.FotoTeam.Browse.Item&method=list&version=1&limit=500&item_type=%5B0%5D&additional=%5B%22description%22%2C%22orientation%22%2C%22tag%22%2C%22resolution%22%5D&offset=${synOffset}&SynoToken=${synoToken}&folder_id=${synoFolder.id}`;
      const synResult = await synoConnection.get(synURL);
      if (synResult.data["success"] === true && Array.isArray(synResult.data["data"]["list"])) {
        if (synResult.data["data"]["list"].length === 0) {
          synEndOfFiles = true;
        } else {
          Helper.ReportingInfo("Debug", "Synology", `Folder ${synoFolder.id} has ${synResult.data["data"]["list"].length} pictures`);
          synResult.data["data"]["list"].forEach((element) => {
            var _a, _b, _c, _d;
            let PictureDate = null;
            if (element.time) {
              PictureDate = synoTimestampToDate(element.time);
            }
            imageList.push({ path: String(element.id), url: "", info1: element.description || "", info2: "", info3: element.filename || "", date: PictureDate, x: ((_b = (_a = element.additional) == null ? void 0 : _a.resolution) == null ? void 0 : _b.height) || 0, y: ((_d = (_c = element.additional) == null ? void 0 : _c.resolution) == null ? void 0 : _d.width) || 0, apiNamespace: "SYNO.FotoTeam" });
          });
          synOffset = synOffset + 500;
        }
      } else {
        Helper.ReportingError(null, "Error getting pictures from Synology", "Synology", "getDsm7FolderItems", JSON.stringify(synResult.data), false);
        return;
      }
    }
  }
}
async function getDsm6Items(Helper, imageList) {
  const baseUrl = getBaseUrl(Helper.Adapter.config.syno_path);
  let synEndOfFiles = false;
  let synOffset = 0;
  while (synEndOfFiles === false) {
    const synURL = `${baseUrl}/photo/webapi/photo.php?api=SYNO.PhotoStation.Photo&method=list&version=1&limit=500&type=photo&offset=${synOffset}`;
    const synResult = await synoConnection.get(synURL);
    if (synResult.data["success"] === true && Array.isArray(synResult.data["data"]["items"])) {
      synResult.data["data"]["items"].forEach((element) => {
        let PictureDate = null;
        if (element.info.takendate) {
          PictureDate = new Date(element.info.takendate);
        }
        imageList.push({ path: element.id, url: "", info1: element.info.title, info2: element.info.description, info3: element.info.name, date: PictureDate, x: element.info.resolutionx, y: element.info.resolutiony, apiNamespace: "" });
      });
      if (synResult.data["data"]["total"] === synResult.data["data"]["offset"]) {
        synEndOfFiles = true;
      } else {
        synOffset = synResult.data["data"]["offset"];
      }
    } else {
      Helper.ReportingError(null, "Error getting pictures from Synology", "Synology", "getDsm6Items", JSON.stringify(synResult.data), false);
      return;
    }
  }
}
async function loginSyno(Helper) {
  var _a, _b, _c, _d, _e, _f, _g;
  try {
    if (Helper.Adapter.config.syno_path === "" || Helper.Adapter.config.syno_path === null) {
      Helper.Adapter.log.error("No name or IP address of Synology configured");
      return false;
    }
    if (Helper.Adapter.config.syno_username === "" || Helper.Adapter.config.syno_username === null) {
      Helper.Adapter.log.error("No username for Synology configured");
      return false;
    }
    if (Helper.Adapter.config.syno_userpass === "" || Helper.Adapter.config.syno_userpass === null) {
      Helper.Adapter.log.error("No password for Synology configured");
      return false;
    }
  } catch (err) {
    Helper.ReportingError(err, "Unknown error", "Synology", "loginSyno/CheckParameters");
    synoConnectionState = false;
    return false;
  }
  if (await synoCheckConnection(Helper) === true) {
    return true;
  } else {
    try {
      const baseUrl = getBaseUrl(Helper.Adapter.config.syno_path);
      if (Helper.Adapter.config.syno_version === 0) {
        const loginUrl = `${baseUrl}/webapi/entry.cgi`;
        Helper.ReportingInfo("Debug", "Synology", `DSM 7 login to ${baseUrl}`);
        const synResult = await synoConnection.get(loginUrl, {
          params: {
            api: "SYNO.API.Auth",
            version: 7,
            method: "login",
            account: Helper.Adapter.config.syno_username,
            passwd: Helper.Adapter.config.syno_userpass,
            enable_syno_token: "yes"
          }
        });
        Helper.ReportingInfo("Debug", "Synology", `DSM 7 login result: success=${(_a = synResult.data) == null ? void 0 : _a.success}`);
        if (((_b = synResult.data) == null ? void 0 : _b.success) === true && ((_d = (_c = synResult.data) == null ? void 0 : _c.data) == null ? void 0 : _d.synotoken)) {
          synoToken = synResult.data.data.synotoken;
          synoConnectionState = true;
          Helper.ReportingInfo("Info", "Synology", "Synology DSM 7 login successful");
          return true;
        } else {
          const errorCode = (_f = (_e = synResult.data) == null ? void 0 : _e.error) == null ? void 0 : _f.code;
          Helper.Adapter.log.error(`Connection failure to Synology Photos (error code: ${errorCode})`);
          synoConnectionState = false;
          return false;
        }
      } else {
        const synResult = await synoConnection.get(`${baseUrl}/photo/webapi/auth.php?api=SYNO.PhotoStation.Auth&method=login&version=1&username=${Helper.Adapter.config.syno_username}&password=${encodeURIComponent(Helper.Adapter.config.syno_userpass)}`);
        Helper.ReportingInfo("Debug", "Synology", "Synology DSM 6 login result", { result: synResult });
        if (synResult.data && synResult.data["data"] && synResult.data["data"]["username"] === Helper.Adapter.config.syno_username) {
          synoConnectionState = true;
          Helper.ReportingInfo("Info", "Synology", "Synology DSM 6 login successful");
          return true;
        } else {
          Helper.Adapter.log.error("Connection failure to Synology PhotoStation");
          synoConnectionState = false;
          return false;
        }
      }
    } catch (err) {
      if (((_g = err.response) == null ? void 0 : _g.status) === 403) {
        Helper.Adapter.log.error("Synology login denied (403 Forbidden)");
        synoConnectionState = false;
        return false;
      } else if (err.isAxiosError === true) {
        Helper.Adapter.log.error(`No connection to Synology: ${err.message}`);
        synoConnectionState = false;
        return false;
      } else {
        Helper.ReportingError(err, "Unknown error", "Synology", "loginSyno/Login");
        synoConnectionState = false;
        return false;
      }
    }
  }
}
async function synoCheckConnection(Helper) {
  var _a, _b, _c;
  if (!synoToken) {
    return false;
  }
  try {
    const baseUrl = getBaseUrl(Helper.Adapter.config.syno_path);
    if (Helper.Adapter.config.syno_version === 0) {
      const synResult = await synoConnection.get(`${baseUrl}/photo/webapi/entry.cgi`, {
        params: {
          api: "SYNO.FotoTeam.Browse.Folder",
          method: "list",
          version: 1,
          id: 1,
          limit: 1,
          offset: 0,
          SynoToken: synoToken
        }
      });
      if (((_a = synResult.data) == null ? void 0 : _a.success) === true) {
        synoConnectionState = true;
        return true;
      } else {
        synoConnectionState = false;
      }
    } else {
      const synoURL = `${baseUrl}/photo/webapi/auth.php?api=SYNO.PhotoStation.Auth&method=checkauth&version=1`;
      const synResult = await synoConnection.get(synoURL);
      if (synResult.status === 200) {
        if (((_b = synResult.data.data) == null ? void 0 : _b.username) === Helper.Adapter.config.syno_username) {
          synoConnectionState = true;
          return true;
        } else {
          synoConnectionState = false;
        }
      } else {
        synoConnectionState = false;
      }
    }
  } catch (err) {
    if (((_c = err.response) == null ? void 0 : _c.status) === 403) {
      synoConnectionState = false;
      return false;
    } else if (err.isAxiosError === true) {
      Helper.Adapter.log.error(`No connection to Synology: ${err.message}`);
      synoConnectionState = false;
      return false;
    } else {
      Helper.ReportingError(err, "Unknown error", "Synology", "synoCheckConnection");
      synoConnectionState = false;
      return false;
    }
  }
  return false;
}
async function synoGetFolders(Helper, FolderID) {
  try {
    const baseUrl = getBaseUrl(Helper.Adapter.config.syno_path);
    let synoEndOfFolders = false;
    let synoOffset = 0;
    while (synoEndOfFolders === false) {
      const synoURL = `${baseUrl}/photo/webapi/entry.cgi?api=SYNO.FotoTeam.Browse.Folder&method=list&version=1&id=${FolderID}&limit=500&offset=${synoOffset}&SynoToken=${synoToken}`;
      Helper.ReportingInfo("Debug", "Synology", `Iterating folder id ${FolderID} `, { URL: synoURL });
      const synResult = await synoConnection.get(synoURL);
      Helper.ReportingInfo("Debug", "Synology", `Result iterating folder id ${FolderID}`, { JSON: JSON.stringify(synResult.data) });
      if (synResult.data["success"] === true && Array.isArray(synResult.data["data"]["list"])) {
        if (synResult.data["data"]["list"].length === 0) {
          synoEndOfFolders = true;
        } else {
          for (const element of synResult.data["data"]["list"]) {
            synoFolders.push({ id: element.id, name: element.name, parent: element.parent });
            await synoGetFolders(Helper, element.id);
          }
          synoOffset = synoOffset + 500;
        }
      } else {
        Helper.ReportingError(null, "Error getting folders from Synology", "Synology", "synoGetFolders", JSON.stringify(synResult.data), false);
        return false;
      }
    }
    return true;
  } catch (err) {
    Helper.ReportingError(err, "Unknown error", "Synology", "synoGetFolders");
    return false;
  }
}
async function sortByKey(array, key) {
  return array.sort(function(a, b) {
    const x = a[key];
    const y = b[key];
    return x < y ? -1 : x > y ? 1 : 0;
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getPicture,
  getPicturePrefetch,
  updatePictureList
});
//# sourceMappingURL=slideSynology.js.map
