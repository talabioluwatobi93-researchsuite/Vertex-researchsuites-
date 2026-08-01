'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
      const [message, setMessage] = useState('')
        const router = useRouter()

          async function handleLogin() {
              const { error } = await supabase.auth.signInWithPassword({ email, password })
                  if (error) {
                        setMessage(error.message)
                            } else {
                                  router.push('/dashboard')
                                      }
                                        }

                                          return (
                                              <div style={{background:"#ffffff",minHeight:"100vh",fontFamily:"Arial",padding:"20px"}}>
                                                    <div style={{maxWidth:"400px",margin:"0 auto",paddingTop:"60px"}}>
                                                            <h1 style={{color:"#D4AF37",textAlign:"center",fontSize:"28px"}}>Vertex ResearchSuite</h1>
                                                                    <p style={{color:"#333333",textAlign:"center",marginBottom:"30px"}}>Login to your account</p>
                                                                            {message && <p style={{color:"red",textAlign:"center"}}>{message}</p>}
                                                                                    <div style={{background:"#f9f9f9",padding:"30px",borderRadius:"10px",border:"1px solid #eee"}}>
                                                                                              <label style={{color:"#333333",fontWeight:"bold",display:"block",marginBottom:"5px"}}>Email</label>
                                                                                                        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your email" style={{width:"100%",padding:"12px",marginBottom:"20px",borderRadius:"5px",border:"1px solid #D4AF37",color:"#333333",boxSizing:"border-box"}} />
                                                                                                                  <label style={{color:"#333333",fontWeight:"bold",display:"block",marginBottom:"5px"}}>Password</label>
                                                                                                                            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" style={{width:"100%",padding:"12px",marginBottom:"20px",borderRadius:"5px",border:"1px solid #D4AF37",color:"#333333",boxSizing:"border-box"}} />
                                                                                                                                      <button onClick={handleLogin} style={{width:"100%",padding:"12px",background:"#D4AF37",color:"#333333",fontWeight:"bold",border:"none",borderRadius:"5px",fontSize:"16px"}}>Login</button>
                                                                                                                                              </div>
                                                                                                                                                      <p style={{textAlign:"center",marginTop:"20px",color:"#333333"}}>No account? <a href="/signup" style={{color:"#D4AF37",fontWeight:"bold"}}>Sign Up</a></p>
                                                                                                                                                            </div>
                                                                                                                                                                </div>
                                                                                                                                                                  )
                                                                                                                                                                }