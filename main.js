const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const https = require("https");

class CatalogDownloader {
  constructor() {
    this.browser = null;
    this.page = null;
    this.pdfDir = path.join(__dirname, "pdfs");
  }

  async init() {
    this.browser = await puppeteer.launch();
    this.page = await this.browser.newPage();
  }

  async fetchCatalogs() {
    await this.page.goto("https://www.tus.si/#s2");
    await this.page.waitForSelector(".page-wrapper");

    return await this.page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(
          "li.list-item.js-match-height-only-by-row.slick-slide.slick-active"
        )
      ).map((item) => ({
        title: item.querySelector("h3").innerText,
        link: item.querySelector("a.link-icon.pdf").href,
        dateRange: item.querySelector("p").innerText,
      }));
    });
  }

  ensurePdfDir() {
    if (!fs.existsSync(this.pdfDir)) {
      fs.mkdirSync(this.pdfDir);
    }
  }

  downloadFile(catalog) {
    return new Promise((resolve, reject) => {
      const fileName = `${catalog.title
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase()}.pdf`;
      const filePath = path.join(this.pdfDir, fileName);
      const file = fs.createWriteStream(filePath);

      https
        .get(catalog.link, (response) => {
          response.pipe(file);
          file.on("finish", () => {
            file.close(() => resolve(fileName));
          });
        })
        .on("error", (error) => {
          fs.unlink(filePath, () =>
            reject(`Error with downloading ${catalog.link}: ${error.message}`)
          );
        });
    });
  }

  async downloadCatalogs(catalogs) {
    this.ensurePdfDir();
    const downloadPromises = catalogs.map((catalog) =>
      this.downloadFile(catalog)
    );
    return await Promise.all(downloadPromises);
  }

  async run() {
    try {
      await this.init();
      const catalogs = await this.fetchCatalogs();
      const downloadedFiles = await this.downloadCatalogs(catalogs);
      fs.writeFileSync("catalogs.json", JSON.stringify(catalogs, null, 2));
      console.log(`pdfs ${downloadedFiles.join(", ")} downloaded successfully`);
    } catch (error) {
      console.error(`Error with downloading files: ${error.message}`);
    } finally {
      await this.browser.close();
    }
  }
}

new CatalogDownloader().run();
