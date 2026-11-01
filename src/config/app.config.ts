import packageInfo from '../../package.json'

export const appConfig = {
  name: 'PhotoShoot Organizer',
  version: packageInfo.version,
  
  limits: {
    maxUploadSize: 100 * 1024 * 1024, // 100MB
    maxResultsUploadSize: 100 * 1024 * 1024, // 100MB
    maxVideoUploadSize: 100 * 1024 * 1024, // 100MB (capped by next.config body limit)
    maxUploadsPerRequest: 20,
  },

  imageProcessing: {
    supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'tiff', 'heic'],
    videoFormats: ['mp4', 'webm', 'mov'],
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
