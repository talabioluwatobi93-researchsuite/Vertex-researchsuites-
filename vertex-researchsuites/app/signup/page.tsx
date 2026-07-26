'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function SignUp() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [type, setType] = useState('')
  const [message, setMessage] = useState('')

  async function handleSignUp() {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name, account_type: type } } })
    if (error) { setMessage(error.message) } else { setMessage('Account created! Check your email.') }
  }

  return (
    <div style={{background:'#ffffff',minHeight:'100vh',fontFamily:'Arial',padding:'20px'}}>
      <div style={{maxWidth:'400px',margin:'0 auto',paddingTop:'40px'}}>
        <h1 style={{color:'#D4AF37',textAlign:'center',fontSize:'24px'}}>Vertex ResearchSuite</h1>
        <p style={{color:'#333333',textAlign:'center',marginBottom:'20px'}}>Create your account</p>
        {message && <p style={{color:'green',textAlign:'center'}}>{message}</p>}
        <label style={{color:'#333333',fontWeight:'bold',display:'block',marginBottom:'5px'}}>Full Name</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder='Enter your full name' style={{width:'100%',padding:'12px',marginBottom:'15px',borderRadius:'5px',border:'1px solid #D4AF37',color:'#333333',fontSize:'14px',boxSizing:'border-box'}} />
        <label style={{color:'#333333',fontWeight:'bold',display:'block',marginBottom:'5px'}}>Email Address</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder='Enter your email' style={{width:'100%',padding:'12px',marginBottom:'15px',borderRadius:'5px',border:'1px solid #D4AF37',color:'#333333',fontSize:'14px',boxSizing:'border-box'}} />
        <label style={{color:'#333333',fontWeight:'bold',display:'block',marginBottom:'5px'}}>Password</label>
        <input type='password' value={password} onChange={e=>setPassword(e.target.value)} placeholder='Create a password' style={{width:'100%',padding:'12px',marginBottom:'15px',borderRadius:'5px',border:'1px solid #D4AF37',color:'#333333',fontSize:'14px',boxSizing:'border-box'}} />
        <label style={{color:'#333333',fontWeight:'bold',display:'block',marginBottom:'5px'}}>Account Type</label>
        <select value={type} onChange={e=>setType(e.target.value)} style={{width:'100%',padding:'12px',marginBottom:'20px',borderRadius:'5px',border:'1px solid #D4AF37',color:'#333333',fontSize:'14px',boxSizing:'border-box',background:'white'}}>
          <option value=''>Select account type</option>
          <option value='student'>Student</option>
          <option value='researcher'>Researcher</option>
          <option value='professional'>Professional</option>
        </select>
        <button onClick={handleSignUp} style={{width:'100%',padding:'12px',background:'#D4AF37',color:'#333333',fontWeight:'bold',border:'none',borderRadius:'5px',fontSize:'16px'}}>Create Account</button>
        <p style={{textAlign:'center',marginTop:'15px',color:'#333333'}}>Already have account? <a href='/login' style={{color:'#D4AF37',fontWeight:'bold'}}>Login</a></p>
      </div>
    </div>
  )
}