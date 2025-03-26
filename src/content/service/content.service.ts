import * as fs from 'fs'
import * as path from 'path'
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ContentRepository } from 'src/content/repository'
import { ProvisionDto } from 'src/content/dto'

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name)
  private readonly expirationTime = 3600 // 1 hour

  constructor(private readonly contentRepository: ContentRepository) {}

  async provision(contentId: string): Promise<ProvisionDto> {
    if (!contentId) {
      this.logger.error(`Invalid Content ID: ${contentId}`)
      throw new UnprocessableEntityException(`Content ID is invalid: ${contentId}`)
    }

    this.logger.log(`Provisioning content for id=${contentId}`)
    let content

    try {
      content = await this.contentRepository.findOne(contentId)
    } catch (error) {
      this.logger.error(`Database error while fetching content: ${error}`)
      throw new NotFoundException(`Database error: ${error}`)
    }

    if (!content) {
      this.logger.warn(`Content not found for id=${contentId}`)
      throw new NotFoundException(`Content not found: ${contentId}`)
    }

    const filePath = content.url ? content.url : undefined
    let bytes = 0

    try {
      bytes = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0
    } catch (error) {
      this.logger.error(`File system error: ${error}`)
    }

    const url = this.generateSignedUrl(content.url || '')

    if (!content.type) {
      this.logger.warn(`Missing content type for ID=${contentId}`)
      throw new BadRequestException('Content type is missing')
    }

    const contentTypes = {
      pdf: {
        type: 'pdf',
        allow_download: true,
        is_embeddable: false,
        format: 'pdf',
        metadata: {
          author: 'Unknown',
          pages: Math.floor(bytes / 50000) || 1,
          encrypted: false,
        },
      },
      image: {
        type: 'image',
        allow_download: true,
        is_embeddable: true,
        format: path.extname(content.url || '').slice(1) || 'jpg',
        metadata: { resolution: '1920x1080', aspect_ratio: '16:9' },
      },
      video: {
        type: 'video',
        allow_download: false,
        is_embeddable: true,
        format: path.extname(content.url || '').slice(1) || 'mp4',
        metadata: { duration: Math.floor(bytes / 100000) || 10, resolution: '1080p' },
      },
      link: {
        type: 'link',
        allow_download: false,
        is_embeddable: true,
        format: null,
        metadata: { trusted: content.url?.includes('https') || false },
      },
      text: {
        type: 'text',
        allow_download: false,
        is_embeddable: true,
        format: 'txt',
        metadata: { word_count: content.description ? content.description.split(' ').length : 0 },
      },
    }

    const contentType = contentTypes[content.type]

    if (!contentType) {
      this.logger.warn(`Unsupported content type for ID=${contentId}, type=${content.type}`)
      throw new BadRequestException(`Unsupported content type: ${content.type}`)
    }

    return {
      id: content.id,
      title: content.title,
      cover: content.cover,
      created_at: content.created_at,
      description: content.description,
      total_likes: content.total_likes,
      type: contentType.type,
      url,
      allow_download: contentType.allow_download,
      is_embeddable: contentType.is_embeddable,
      format: contentType.format,
      bytes,
      metadata: contentType.metadata,
    }
  }

  private generateSignedUrl(originalUrl: string): string {
    const expires = Math.floor(Date.now() / 1000) + this.expirationTime
    return `${originalUrl}?expires=${expires}&signature=${Math.random().toString(36).substring(7)}`
  }
}
