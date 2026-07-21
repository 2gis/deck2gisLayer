import { defineConfig } from "vite";
import { copyFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import dts from "vite-plugin-dts";

function copyAfterBuild() {
  return {
    name: "copy-after-build",
    apply: "build",
    writeBundle() {
      const src = join(process.cwd(), "dist", "demo.js");
      const dest = join(process.cwd(), "demo", "demo-bundle.js");
      try {
        mkdirSync(join(process.cwd(), "demo"), { recursive: true });
        copyFileSync(src, dest);
        console.log("Copied demo.js to demo folder");
      } catch (e) {
        console.error("Copy failed:", e);
      }
    },
  };
}

// Treat shader files as plain text modules
function shaderAsText() {
  return {
    name: "shader-as-text",
    enforce: "pre",
    resolveId(source, importer) {
      if (source.endsWith(".fsh") || source.endsWith(".vsh")) {
        // let Vite/Rollup handle resolution to an absolute id
        return this.resolve(source, importer, { skipSelf: true }).then(
          (res) => res && res.id,
        );
      }
      return null;
    },
    load(id) {
      if (id.endsWith(".fsh") || id.endsWith(".vsh")) {
        const code = readFileSync(id, "utf-8");
        return `export default ${JSON.stringify(code)};`;
      }
      return null;
    },
  };
}

export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    if (mode === "demo") {
      // сборка демо‑скрипта
      return {
        root: "demo",
        resolve: {
          alias: [
            { find: "@deck.gl/core/typed", replacement: "@deck.gl/core" },
          ],
        },
        build: {
          outDir: "../dist",
          emptyOutDir: false,
          minify: false,
          rollupOptions: {
            input: "./demo/demo.ts",
            // treat bare imports as external for demo build

            output: {
              format: "iife",
              name: "Demo",
              entryFileNames: "demo.js",
            },
          },
        },
        plugins: [shaderAsText(), copyAfterBuild()],
      };
    } else if (mode === "plain") {
      // сборка в обычный скрипт (IIFE), не модуль
      return {
        root: ".",
        resolve: {
          alias: [
            { find: "@deck.gl/core/typed", replacement: "@deck.gl/core" },
          ],
        },
        build: {
          outDir: "dist",
          emptyOutDir: false,
          minify: true,
          rollupOptions: {
            input: "./src/index.ts",
            output: {
              format: "iife",
              name: "deck2gisLayer",
              entryFileNames: "index.js",
            },
          },
        },
        plugins: [shaderAsText()],
      };
    } else if (mode === "esm") {
      // сборка в ES-модуль с именованными экспортами Deck2gisLayer, initDeck
      return {
        root: ".",
        resolve: {
          alias: [
            { find: "@deck.gl/core/typed", replacement: "@deck.gl/core" },
          ],
        },
        build: {
          outDir: "dist",
          emptyOutDir: false,
          minify: true,
          rollupOptions: {
            input: "./src/index.ts",
            external: [
              "@deck.gl/core",
              "@deck.gl/layers",
              "@deck.gl/core/typed",
            ],
            output: {
              format: "es",
              entryFileNames: "index.esm.js",
              preserveModules: false,
            },
          },
        },
        plugins: [shaderAsText()],
      };
    } else {
      // обычная сборка основного кода из src (ES module для импортирования)
      return {
        root: ".",
        resolve: {
          alias: [
            { find: "@deck.gl/core/typed", replacement: "@deck.gl/core" },
          ],
        },
        build: {
          outDir: "dist",
          emptyOutDir: true,
          // true
          minify: true,
          lib: {
            entry: "./src/index.ts",
            name: "deck2gisLayer",
            formats: ["umd"],
            fileName: () => "deck2gislayer.js",
          },
        },
        plugins: [
          shaderAsText(),
          dts({
            outDir: "dist/types",
            tsconfigPath: "./tsconfig.json",
            entryRoot: "src",
            include: ["src"],
          }),
        ],
      };
    }
  }

  // Dev режим: поддерживаем работу с demo
  return {
    root: "demo",
    resolve: {
      alias: [{ find: "@deck.gl/core/typed", replacement: "@deck.gl/core" }],
    },
    build: {
      outDir: "../dist",
      emptyOutDir: true,
      minify: false,
      rollupOptions: {
        input: "./demo/demo.ts",
        output: {
          format: "iife",
          name: "Demo",
          entryFileNames: "demo.js",
        },
      },
    },
    plugins: [shaderAsText(), copyAfterBuild()],
  };
});
