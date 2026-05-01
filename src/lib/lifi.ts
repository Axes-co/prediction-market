import { createConfig } from '@lifi/sdk'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { decryptSecret } from '@/lib/encryption'
import 'server-only'

const GENERAL_SETTINGS_GROUP = 'general'
const LIFI_INTEGRATOR_KEY = 'lifi_integrator'
const LIFI_API_KEY = 'lifi_api_key'
const DEFAULT_LIFI_INTEGRATOR = 'lifi-sdk'

let configuredSignature: string | null = null

function normalizeSettingValue(value: string | undefined) {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : null
}

export async function ensureLiFiServerConfig() {
  let settingsIntegrator: string | null = null
  let settingsApiKey: string | null = null

  const { data: allSettings, error } = await SettingsRepository.getSettings()
  if (!error) {
    const generalSettings = allSettings?.[GENERAL_SETTINGS_GROUP]
    settingsIntegrator = normalizeSettingValue(generalSettings?.[LIFI_INTEGRATOR_KEY]?.value)
    settingsApiKey = normalizeSettingValue(decryptSecret(generalSettings?.[LIFI_API_KEY]?.value))
  }

  const integrator = settingsIntegrator
    ?? normalizeSettingValue(process.env.LIFI_INTEGRATOR)
    ?? DEFAULT_LIFI_INTEGRATOR
  const apiKey = settingsApiKey ?? normalizeSettingValue(process.env.LIFI_API_KEY)

  const nextSignature = `${integrator}::${apiKey ?? ''}`
  if (configuredSignature === nextSignature) {
    return
  }

  if (apiKey) {
    createConfig({
      integrator,
      apiKey,
    })
  }
  else {
    createConfig({ integrator })
  }

  configuredSignature = nextSignature
}
