const Template = require('webpack/lib/Template');
const JsonpMainTemplateRuntime = require('./JsonpMainTemplate.runtime');

const builtInJsonpPlugin = 'JsonpMainTemplatePlugin';
// use a big stage to ensure register later than builtin JsonpMainTemplatePlugin,
// thus we could remove the builtin JsonpMainTemplatePlugin
const HMRStage = 999;

class HippyHMRPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap({
      name: 'HippyHMRPlugin', 
      stage: HMRStage
    }, (compilation) => {
      const { mainTemplate } = compilation;
      const hmrTaps = mainTemplate.hooks.hotBootstrap.taps;
      for (let i = 0; i < hmrTaps.length; i += 1) {
        if (hmrTaps[i].name === builtInJsonpPlugin) {
          // remove builtin JsonpMainTemplatePlugin
          hmrTaps.splice(i, 1);
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
        }
      }
    });
  }
}

module.exports = HippyHMRPlugin;
