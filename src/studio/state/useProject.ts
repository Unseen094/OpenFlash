import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ProjectData, ProjectMeta, createEmptyProject, loadProject, saveProject, listProjects,
  exportProjectJson, importProjectJson, setStorageProvider
} from '../../lib/projects'
import { StorageProvider } from '../../lib/storage/StorageProvider'
import { useAuth } from '../../context/AuthContext'

export interface ProjectState {
  currentProjectId: string | null
  projectName: string
  projectAutosave: boolean
  projectsMenuOpen: boolean
  savedProjects: ProjectMeta[]
  lastSaved: number | null
  unsavedChanges: boolean
}

export interface ProjectActions {
  setCurrentProjectId: (id: string | null) => void
  setProjectName: (name: string) => void
  toggleAutosave: () => void
  toggleProjectsMenu: () => void
  setSavedProjects: (projects: ProjectMeta[]) => void
  setUnsavedChanges: (val: boolean) => void
  refreshSavedProjects: () => void
  saveCurrentProject: (
    shapes: any[],
    code: string,
    timeline: any,
    shaders: Set<string>
  ) => void
  openProject: (id: string) => void
  newProject: () => void
  exportJson: (
    projectName: string,
    shapes: any[],
    code: string,
    timeline: any,
    shaders: Set<string>
  ) => void
  importJson: (file: File) => void
  applyProject: (p: ProjectData) => void
  setProvider: (provider: StorageProvider) => void
}

export function useProject(): ProjectState & ProjectActions {
  const { user } = useAuth()
  const owner = user?.email || user?.uid || 'anonymous'
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('Untitled Project')
  const [projectAutosave, setProjectAutosave] = useState(false)
  const [projectsMenuOpen, setProjectsMenuOpen] = useState(false)
  const [savedProjects, setSavedProjects] = useState<ProjectMeta[]>([])
  const [lastSaved, setLastSaved] = useState<number | null>(null)
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const loadedProjectRef = useRef(false)

  const refreshSavedProjects = useCallback(() => {
    setSavedProjects(listProjects(owner))
  }, [owner])

  const saveCurrentProject = useCallback((
    shapes: any[],
    code: string,
    timeline: any,
    shaders: Set<string>
  ) => {
    const project: ProjectData = {
      id: currentProjectId || createEmptyProject(owner, projectName).id,
      name: projectName.trim() || 'Untitled Project',
      owner,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      shapes,
      code,
      timeline,
      shaders: Array.from(shaders),
      autosave: projectAutosave,
      version: 1
    }
    saveProject(project)
    setCurrentProjectId(project.id)
    refreshSavedProjects()
    setLastSaved(Date.now())
    setUnsavedChanges(false)
  }, [currentProjectId, owner, projectName, projectAutosave, refreshSavedProjects])

  const applyProject = useCallback((p: ProjectData) => {
    setCurrentProjectId(p.id)
    setProjectName(p.name)
    setProjectAutosave(p.autosave)
    setUnsavedChanges(false)
  }, [])

  const newProject = useCallback(() => {
    const fresh = createEmptyProject(owner, 'Untitled Project')
    applyProject({ ...fresh, id: '' })
    setCurrentProjectId(null)
  }, [owner, applyProject])

  const openProject = useCallback((id: string) => {
    const p = loadProject(id)
    if (p) {
      applyProject(p)
      setProjectsMenuOpen(false)
    }
  }, [applyProject])

  const exportJson = useCallback((
    name: string,
    shapes: any[],
    code: string,
    timeline: any,
    shaders: Set<string>
  ) => {
    const project: ProjectData = {
      id: currentProjectId || `proj_${Date.now().toString(36)}`,
      name,
      owner,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      shapes,
      code,
      timeline,
      shaders: Array.from(shaders),
      autosave: false,
      version: 1
    }
    const blob = new Blob([exportProjectJson(project)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/[^a-z0-9-_]/gi, '_') || 'project'}.openflash.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [currentProjectId, owner])

  const importJson = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const p = importProjectJson(String(reader.result), owner)
      if (p) {
        applyProject(p)
      }
    }
    reader.readAsText(file)
  }, [owner, applyProject])

  const setProvider = useCallback((provider: StorageProvider) => {
    setStorageProvider(provider)
  }, [])

  useEffect(() => {
    refreshSavedProjects()
    loadedProjectRef.current = true
  }, [refreshSavedProjects])

  return {
    currentProjectId,
    projectName,
    projectAutosave,
    projectsMenuOpen,
    savedProjects,
    lastSaved,
    unsavedChanges,
    setCurrentProjectId,
    setProjectName,
    toggleAutosave: () => setProjectAutosave(p => !p),
    toggleProjectsMenu: () => setProjectsMenuOpen(o => !o),
    setSavedProjects,
    setUnsavedChanges,
    refreshSavedProjects,
    saveCurrentProject,
    openProject,
    newProject,
    exportJson,
    importJson,
    applyProject,
    setProvider
  }
}
