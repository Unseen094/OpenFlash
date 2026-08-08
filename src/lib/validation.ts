import { z } from 'zod'

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  owner: z.string().min(1),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  shapes: z.array(z.unknown()),
  code: z.string(),
  timeline: z.object({
    layers: z.array(z.unknown()),
    currentFrame: z.number().int().positive(),
    totalFrames: z.number().int().positive(),
    fps: z.number().int().positive(),
    loop: z.boolean()
  }),
  shaders: z.array(z.string()),
  autosave: z.boolean()
})

export const ProjectMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  owner: z.string().min(1),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  shapeCount: z.number().int().nonnegative(),
  codeLines: z.number().int().nonnegative()
})

export const ImportCodeSchema = z.object({
  code: z.string().min(1).max(50000)
})

export const ExportJsonSchema = z.object({
  project: ProjectSchema.optional()
})

export type ProjectSchema = z.infer<typeof ProjectSchema>
export type ProjectMetaSchema = z.infer<typeof ProjectMetaSchema>
