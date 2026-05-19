import { supabase } from './supabaseClient'

export interface Employee {
  id: string
  name: string
  email: string | null
}

export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, name, email')
    .order('name')

  if (error) throw new Error(`getEmployees failed: ${error.message}`)
  return (data ?? []) as Employee[]
}

export async function createEmployee(name: string, email?: string): Promise<Employee> {
  const { data, error } = await supabase
    .from('employees')
    .insert({ name, email: email ?? null })
    .select('id, name, email')
    .single()

  if (error) throw new Error(`createEmployee failed: ${error.message}`)
  return data as Employee
}

export async function getOrCreateEmployee(name: string, email?: string): Promise<Employee> {
  const { data: existing } = await supabase
    .from('employees')
    .select('id, name, email')
    .eq('name', name)
    .maybeSingle()

  if (existing) return existing as Employee
  return createEmployee(name, email)
}
