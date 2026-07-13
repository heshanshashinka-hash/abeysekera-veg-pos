import { boot } from 'quasar/wrappers'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iatefxzahmkuvapixikm.supabase.co'
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhdGVmeHphaG1rdXZhcGl4aWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNjgyNzUsImV4cCI6MjA5Njk0NDI3NX0.2zX0Gp7ja1PxHtk-8_XXOMpyuYFasQaQEtYhU6Bbzic'

const supabase = createClient(supabaseUrl, supabaseKey)

export default boot(({ app }) => {
  app.config.globalProperties.$supabase = supabase
})

export { supabase }
