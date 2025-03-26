import { Test, TestingModule } from '@nestjs/testing'
import { ContentRepository } from 'src/content/repository'
import { DataSource } from 'typeorm'
import { Content } from 'src/content/entity'

describe('ContentRepository', () => {
  let contentRepository: ContentRepository
  let dataSource: DataSource

  const mockContent: Content = {
    id: '4372ebd1-2ee8-4501-9ed5-549df46d0eb0',
    title: 'Sample Content',
    description: 'Test Description',
    url: 'http://localhost:3000/uploads/dummy.pdf',
    created_at: new Date('2025-01-31T23:39:54.236Z'),
    total_likes: 10,
    type: 'pdf',
  } as Content

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentRepository,
        {
          provide: DataSource,
          useValue: { query: jest.fn() },
        },
      ],
    }).compile()

    contentRepository = module.get<ContentRepository>(ContentRepository)
    dataSource = module.get<DataSource>(DataSource)
  })

  it('[findOne] Should return content when found', async () => {
    jest.spyOn(dataSource, 'query').mockResolvedValue([mockContent])

    const result = await contentRepository.findOne(mockContent.id)

    expect(dataSource.query).toHaveBeenCalledWith(
      `SELECT * FROM contents WHERE id = '${mockContent.id}' AND deleted_at IS NULL LIMIT 1`,
    )
    expect(result).toStrictEqual(mockContent)
  })

  it('[findOne] Should return null if content is not found', async () => {
    jest.spyOn(dataSource, 'query').mockResolvedValue([])

    const result = await contentRepository.findOne('non-existent-id')

    expect(dataSource.query).toHaveBeenCalledWith(
      `SELECT * FROM contents WHERE id = 'non-existent-id' AND deleted_at IS NULL LIMIT 1`,
    )
    expect(result).toBeNull()
  })

  it('[findOne] Should throw error if database query fails', async () => {
    jest.spyOn(dataSource, 'query').mockRejectedValue(new Error('Database error'))

    await expect(contentRepository.findOne(mockContent.id)).rejects.toThrow('Database error')
  })
})
