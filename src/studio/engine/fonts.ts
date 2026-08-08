export const GOOGLE_FONTS = [
  'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Inter',
  'Raleway', 'Ubuntu', 'Playfair Display', 'Merriweather', 'Nunito',
  'PT Sans', 'Source Sans Pro', 'Work Sans', 'Fira Code', 'Space Mono'
]

const loadedFonts = new Set<string>()

export const loadGoogleFont = (fontName: string) => {
  if (loadedFonts.has(fontName)) return
  const link = document.createElement('link')
  link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@400;700&display=swap`
  link.rel = 'stylesheet'
  document.head.appendChild(link)
  loadedFonts.add(fontName)
}

export const loadAllGoogleFonts = () => {
  GOOGLE_FONTS.forEach(loadGoogleFont)
}

export const getFontUrl = (fontName: string): string =>
  `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@400;700&display=swap`
