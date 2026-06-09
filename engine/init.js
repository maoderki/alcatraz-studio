(function () {
    const scripts = [
        'engine/runtime.js',
        'engine/color.js',
        'engine/layers.js',
        'engine/session.js',
        'engine/targets.js',
        'engine/state.js',
        'engine/commands.js',
        'engine/raster.js',
        'engine/render.js'
    ];

    const assetUrl = typeof window.studioAssetUrl === 'function'
        ? window.studioAssetUrl
        : path => path;

    scripts.forEach(path => {
        document.write(`<script src="${assetUrl(path)}"><\/script>`);
    });
}());
