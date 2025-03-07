import type { NextConfigComplete } from '../config-shared'

import '../node-polyfill-fetch'
import {
  buildAppStaticPaths,
  buildStaticPaths,
  collectGenerateParams,
} from '../../build/utils'
import { loadComponents } from '../load-components'
import { setHttpClientAndAgentOptions } from '../config'

type RuntimeConfig = any

let workerWasUsed = false

// we call getStaticPaths in a separate process to ensure
// side-effects aren't relied on in dev that will break
// during a production build
export async function loadStaticPaths({
  distDir,
  pathname,
  config,
  httpAgentOptions,
  enableUndici,
  locales,
  defaultLocale,
  isAppPath,
  originalAppPath,
}: {
  distDir: string
  pathname: string
  config: RuntimeConfig
  httpAgentOptions: NextConfigComplete['httpAgentOptions']
  enableUndici: NextConfigComplete['enableUndici']
  locales?: string[]
  defaultLocale?: string
  isAppPath?: boolean
  originalAppPath?: string
}): Promise<{
  paths?: string[]
  encodedPaths?: string[]
  fallback?: boolean | 'blocking'
}> {
  // we only want to use each worker once to prevent any invalid
  // caches
  if (workerWasUsed) {
    process.exit(1)
  }

  // update work memory runtime-config
  require('../../shared/lib/runtime-config').setConfig(config)
  setHttpClientAndAgentOptions({
    httpAgentOptions,
    experimental: { enableUndici },
  })

  const components = await loadComponents({
    distDir,
    pathname: originalAppPath || pathname,
    hasServerComponents: false,
    isAppPath: !!isAppPath,
  })

  if (!components.getStaticPaths && !isAppPath) {
    // we shouldn't get to this point since the worker should
    // only be called for SSG pages with getStaticPaths
    throw new Error(
      `Invariant: failed to load page with getStaticPaths for ${pathname}`
    )
  }
  workerWasUsed = true

  if (isAppPath) {
    const generateParams = collectGenerateParams(components.ComponentMod.tree)
    return buildAppStaticPaths({
      page: pathname,
      generateParams,
      configFileName: config.configFileName,
    })
  }

  return buildStaticPaths({
    page: pathname,
    getStaticPaths: components.getStaticPaths,
    configFileName: config.configFileName,
    locales,
    defaultLocale,
  })
}
