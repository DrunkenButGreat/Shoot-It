import prisma from '@/lib/prisma'

type FolderKind = 'selection' | 'results'

export async function ensureFolderStructure(kind: FolderKind, projectId: string, relativePath: string, startingFolderId: string | null = null) {
  const parts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean)
  parts.pop()
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const folders: Pick<typeof tx.selectionFolder, 'findFirst' | 'findFirstOrThrow' | 'create'> = kind === 'selection' ? tx.selectionFolder : tx.resultFolder as unknown as typeof tx.selectionFolder
        let parentId = startingFolderId
        let currentPath = startingFolderId ? (await folders.findFirstOrThrow({ where: { id: startingFolderId, projectId } })).path : ''
        for (const name of parts) {
          const where = { name, projectId, parentId }
          const folder = await folders.findFirst({ where }) ?? await folders.create({ data: { ...where, path: `${currentPath}/${name}` } })
          parentId = folder.id
          currentPath = folder.path
        }
        return parentId
      }, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (attempt >= 9 || !['P2002', 'P2034'].includes((error as { code?: string }).code ?? '')) throw error
    }
  }
}
