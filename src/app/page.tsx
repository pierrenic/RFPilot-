'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  FileText, 
  Users, 
  BarChart3, 
  FileOutput,
  Sparkles,
  ArrowRight
} from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">Bidly</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost">Se connecter</Button>
            <Button>Commencer</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          Propulsé par l'IA
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-slate-900 mb-6 max-w-3xl mx-auto">
          Répondez aux appels d'offres <span className="text-blue-600">10x plus vite</span>
        </h1>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
          Importez votre cahier des charges, laissez l'IA générer les premières réponses, 
          collaborez avec votre équipe, exportez en un clic.
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg" className="gap-2">
            Démarrer un projet
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button size="lg" variant="outline">
            Voir une démo
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Comment ça marche</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-2 hover:border-blue-200 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>1. Importez</CardTitle>
              <CardDescription>
                Uploadez votre cahier des charges (PDF, Word). L'IA extrait automatiquement les questions et exigences.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-blue-200 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle>2. Générez</CardTitle>
              <CardDescription>
                L'IA génère une première version de chaque réponse à partir de votre corpus documentaire.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-blue-200 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>3. Collaborez</CardTitle>
              <CardDescription>
                Assignez des contributeurs par thème. Workflow séquentiel : rédaction → review → validation.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-blue-200 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
                <FileOutput className="w-6 h-6 text-orange-600" />
              </div>
              <CardTitle>4. Exportez</CardTitle>
              <CardDescription>
                Générez automatiquement Google Doc, Sheets et Slides formatés pour la soumission.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-slate-900 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-10 text-center">
            <div>
              <div className="text-5xl font-bold text-blue-400 mb-2">10x</div>
              <div className="text-slate-400">Plus rapide qu'une rédaction manuelle</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-green-400 mb-2">80%</div>
              <div className="text-slate-400">De gain de temps sur le premier jet</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-purple-400 mb-2">100%</div>
              <div className="text-slate-400">Traçabilité des contributions</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold mb-6">Prêt à transformer vos réponses aux AO ?</h2>
        <p className="text-lg text-slate-600 mb-8">
          Commencez gratuitement, sans engagement.
        </p>
        <Button size="lg" className="gap-2">
          Créer mon premier projet
          <ArrowRight className="w-4 h-4" />
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
          <p>© 2026 Bidly. Propulsé par Arianee.</p>
        </div>
      </footer>
    </div>
  )
}
