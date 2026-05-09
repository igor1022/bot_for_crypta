import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

const test = async () => {
  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        telegram_id: '123456',
        username: 'igor'
      }
    ])

  console.log(data)
  console.log(error)
}

test()