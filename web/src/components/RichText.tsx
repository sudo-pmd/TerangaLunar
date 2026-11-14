import { Fragment } from 'react'
import { Term } from './common'

/** Texte avec termes de glossaire : [[cle|texte affiché]] devient une infobulle (F-72). */
export default function RichText({ text }: { text: string }) {
  const parts = text.split(/(\[\[[a-z_0-9]+(?:\|[^\]]*)?\]\])/g)
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[\[([a-z_0-9]+)(?:\|([^\]]*))?\]\]$/)
        return m ? <Term key={i} k={m[1]}>{m[2] || undefined}</Term> : <Fragment key={i}>{p}</Fragment>
      })}
    </>
  )
}
