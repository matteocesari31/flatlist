const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// Only watch mobile/ and shared/ so Metro doesn't scan web/ or root node_modules
config.watchFolders = [
  projectRoot,
  path.join(monorepoRoot, 'shared'),
]

// Resolve modules from mobile/node_modules only (don't use parent node_modules for Metro)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
]

module.exports = config
