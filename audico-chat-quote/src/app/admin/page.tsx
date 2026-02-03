import { AdminShell } from "@/components/admin/admin-shell";
import { FileText, Users, Database } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
    const cards = [
        {
            title: "Quotes & Fulfillment",
            description: "View incoming quotes, check items to ship, and review chat histories.",
            href: "/admin/quotes",
            icon: <FileText className="w-8 h-8 text-blue-500" />,
            color: "bg-blue-500/10 border-blue-500/20"
        },
        {
            title: "Consultations",
            description: "Manage specialist consultation requests and project leads.",
            href: "/admin/consultations",
            icon: <Users className="w-8 h-8 text-purple-500" />,
            color: "bg-purple-500/10 border-purple-500/20"
        },
        {
            title: "Data Enrichment",
            description: "Tools for enriching product data and managing vector embeddings.",
            href: "/admin/enrich",
            icon: <Database className="w-8 h-8 text-amber-500" />,
            color: "bg-amber-500/10 border-amber-500/20"
        }
    ];

    return (
        <AdminShell>
            <div className="w-full h-full flex flex-col p-8 max-w-6xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-3xl font-bold mb-2">Audico Management</h1>
                    <p className="text-muted-foreground">
                        Welcome to the admin control center.
                    </p>
                </header>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map((card) => (
                        <Link
                            key={card.href}
                            href={card.href}
                            className={`block p-6 rounded-xl border ${card.color} hover:opacity-90 transition-opacity bg-background-elevated`}
                        >
                            <div className="mb-4 p-3 bg-background rounded-lg inline-block shadow-sm">
                                {card.icon}
                            </div>
                            <h3 className="text-lg font-semibold mb-2">{card.title}</h3>
                            <p className="text-sm text-muted-foreground">{card.description}</p>
                        </Link>
                    ))}
                </div>
            </div>
        </AdminShell>
    );
}
