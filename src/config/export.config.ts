export const exportConfig = {
  selection: {
    defaultSeparator: '\n',
    defaultFormat: 'txt' as const,
    includeExtension: true,
  },
  
  pdf: {
    author: 'PhotoShoot Organizer',
    creator: 'PhotoShoot Organizer v2.0',
  },
  
  zip: {
    compressionLevel: 6,
  },
} as const
