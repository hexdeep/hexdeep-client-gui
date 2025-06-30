import { defineConfig } from 'vite';
import { createVuePlugin } from "vite-plugin-vue2";
import { viteCommonjs } from "@originjs/vite-plugin-commonjs";
import { envPlugin } from "./vite_plugin/env";
import path from 'path';
import fs from 'fs';
// import monacoEditorPlugin from 'vite-plugin-monaco-editor';
// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 8005,
    // host: "[::]",
    host: "0.0.0.0",
    // https: {
    //   key: fs.readFileSync("./ssl/cert.key"),
    //   cert: fs.readFileSync("./ssl/cert.pem"),
    // },
    // proxy: {
    //   "/api": "http://127.0.0.1:3000/"
    // }

  },
  define: {
    'process.platform': `"${process.platform}"`,
  },
  plugins: [
    createVuePlugin({
      jsx: true,
    }),
    viteCommonjs(),
    envPlugin(),
  ],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(__dirname, "src"),
      },
    ]
  },
});