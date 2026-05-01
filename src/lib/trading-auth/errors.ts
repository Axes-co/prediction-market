export const TRADING_AUTH_REQUIRED_ERROR = 'Enable trading to continue.'
export const TOKEN_APPROVAL_REQUIRED_ERROR = 'Approve tokens to continue.'

export function isTradingAuthRequiredError(message: string | null | undefined) {
  if (!message) {
    return false
  }

  return (
    message === TRADING_AUTH_REQUIRED_ERROR
    || message.toLowerCase().includes('enable trading')
  )
}

export function isTokenApprovalRequiredError(message: string | null | undefined) {
  if (!message) {
    return false
  }

  return (
    message === TOKEN_APPROVAL_REQUIRED_ERROR
    || message.toLowerCase().includes('approve tokens')
  )
}
