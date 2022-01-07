const Template = require('webpack/lib/Template');
const JsonpMainTemplateRuntime = require('./JsonpMainTemplate.runtime');

const builtInJsonpPlugin = 'JsonpMainTemplatePlugin';
// use a big stage to ensure register later than builtin JsonpMainTemplatePlugin,
// thus we could remove the builtin JsonpMainTemplatePlugin
const HMRStage = 1000;

class HippyHMRPlugin {
  constructor({ hotManifestPublicPath }) {
    this.hotManifestPublicPath = hotManifestPublicPath;
  }

  apply(compiler) {
    removeTap(compiler.hooks.thisCompilation.taps, HippyHMRPlugin.name);
    compiler.hooks.thisCompilation.tap(
      {
        name: HippyHMRPlugin.name,
        stage: HMRStage,
      },
      (compilation) => {
        const { mainTemplate } = compilation;
        removeTap(mainTemplate.hooks.hotBootstrap.taps, builtInJsonpPlugin);
        mainTemplate.hooks.hotBootstrap.tap(builtInJsonpPlugin, (source, chunk, hash) => {
          const globalObject = mainTemplate.outputOptions.globalObject;
          const hotUpdateChunkFilename = mainTemplate.outputOptions.hotUpdateChunkFilename;
          const hotUpdateMainFilename = mainTemplate.outputOptions.hotUpdateMainFilename;
          const crossOriginLoading = mainTemplate.outputOptions.crossOriginLoading;
          const hotUpdateFunction = mainTemplate.outputOptions.hotUpdateFunction;
          const currentHotUpdateChunkFilename = mainTemplate.getAssetPath(JSON.stringify(hotUpdateChunkFilename), {
            hash: `" + ${mainTemplate.renderCurrentHashCode(hash)} + "`,
            hashWithLength: (length) => `" + ${mainTemplate.renderCurrentHashCode(hash, length)} + "`,
            chunk: {
              id: '" + chunkId + "',
            },
          });
          const currentHotUpdateMainFilename = mainTemplate.getAssetPath(JSON.stringify(hotUpdateMainFilename), {
            hash: `" + ${mainTemplate.renderCurrentHashCode(hash)} + "`,
            hashWithLength: (length) => `" + ${mainTemplate.renderCurrentHashCode(hash, length)} + "`,
          });
          const runtimeSource = Template.getFunctionContent(JsonpMainTemplateRuntime)
            .replace(/\/\/\$semicolon/g, ';')
            .replace(/\$require\$/g, mainTemplate.requireFn)
            .replace(/\$crossOriginLoading\$/g, crossOriginLoading ? JSON.stringify(crossOriginLoading) : 'null')
            .replace(/\$hotMainFilename\$/g, currentHotUpdateMainFilename)
            .replace(/\$hotChunkFilename\$/g, currentHotUpdateChunkFilename)
            .replace(/\$hash\$/g, JSON.stringify(hash));
          return `${source}
function hotDisposeChunk(chunkId) {
	delete installedChunks[chunkId];
}
var parentHotUpdateCallback = ${globalObject}[${JSON.stringify(hotUpdateFunction)}];
${globalObject}[${JSON.stringify(hotUpdateFunction)}] = ${runtimeSource}`;
        });
      },
    );

    compiler.hooks.compilation.tap('VendorImport', (compilation) => {
      compilation.mainTemplate.hooks.localVars.tap('Require', (source) => {
        // hotDownloadManifest will use hotManifestPublicPath to concat the full manifest path.
        return `var hotManifestPublicPath = '${this.hotManifestPublicPath}'; \n${source}`;
      });
    });
  }
}

function removeTap(taps, name) {
  const i = taps.findIndex((tap) => tap.name === name);
  if (i !== -1) {
    taps.splice(i, 1);
  }
}

module.exports = HippyHMRPlugin;
