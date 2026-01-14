export async function verifyRecaptcha(token: string) {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY

  if (!secretKey) {
    console.error('RECAPTCHA_SECRET_KEY is not set. Rejecting registration for security.')
    return false
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    })

    const data = await response.json()

    if (data.success && data.score >= 0.5) {
      return true
    }

    console.error('ReCAPTCHA verification failed:', data)
    return false
  } catch (error) {
    console.error('Error during ReCAPTCHA verification:', error)
    return false
  }
}
