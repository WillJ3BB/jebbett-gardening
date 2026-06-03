// Supabase connection
const SUPABASE_URL = 'https://sixuzyfvfuztghckhmpn.supabase.co'
const SUPABASE_KEY = 'sb_publishable_zB18KW8wgu6e1FDbP95pvQ_YVqf2W_R'

const { createClient } = supabase
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY)