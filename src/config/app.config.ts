export const appConfig = {
  name: 'PhotoShoot Organizer',
  version: '2.0.0',
  
  limits: {
    maxUploadSize: 10 * 1024 * 1024, // 10MB
    maxResultsUploadSize: 100 * 1024 * 1024, // 100MB
    maxUploadsPerRequest: 20,
  },
  
  imageProcessing: {
    supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'tiff', 'heic'],
    thumbnailWidth: 300,
    thumbnailHeight: 300,
    thumbnailQuality: 80,
    resultsPreviewMaxWidth: 2560,
    resultsPreviewMaxHeight: 2560,
    resultsPreviewQuality: 85,
  },
  
  shortcode: {
    length: 8,
    charset: 'abcdefghijklmnopqrstuvwxyz0123456789',
  },
} as const
