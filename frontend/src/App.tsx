import { Button } from "./components/ui/button"
import { toast } from "sonner"

function App() {
  const toastMsg = ()=>{
    toast.success("Event has been created successfully")
  }
  return (
    <div className="w-full h-screen bg-black text-white flex justify-center items-center gap-4 flex-col">
    <h1 className="text-6xl">Shahparpay</h1>
    <Button className="px-5 py-5" onClick={toastMsg}>Click me</Button>
    </div>
  )
}

export default App
