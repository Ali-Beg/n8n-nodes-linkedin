const { src, dest, series } = require('gulp');
const path = require('path');

/**
 * Copies the custom node icon from its source location to the build folder
 */
function buildIcons() {
	return src('./src/nodes/**/icons/*.svg')
		.pipe(dest('./dist/nodes/'));
}

/**
 * Helper to copy node icons for a specific node
 */
function copyNodeIcons() {
	return src('./src/nodes/LinkedIn/icons/linkedin.svg')
		.pipe(dest('./dist/nodes/LinkedIn/icons/'))
		.pipe(dest('./dist/nodes/LinkedIn/')); // Copy to both locations for compatibility
}

// Export both tasks and a combined task as build:icons
exports['build:icons'] = series(buildIcons, copyNodeIcons);
exports.buildIcons = buildIcons;
exports.copyNodeIcons = copyNodeIcons;