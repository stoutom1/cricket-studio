"use client";
export default function PrintButton() {
  return <button type="button" onClick={() => window.print()} style={{padding:"11px 16px",borderRadius:10,border:"1px solid #7ab9f0",background:"#17466e",color:"white",cursor:"pointer"}}>Print / Save receipt as PDF</button>;
}
