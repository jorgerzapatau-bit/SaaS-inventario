"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Save, ArrowLeft } from "lucide-react";
import { fetchApi } from "@/lib/api";

export default function NewSupplierPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        nombre: "",
        contacto: "",
        email: "",
        telefono: "",
        direccion: "",
        sitioWeb: "",
        notas: ""
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await fetchApi("/suppliers", {
                method: "POST",
                body: JSON.stringify(formData),
            });

            router.push("/dashboard/suppliers");
            router.refresh();
        } catch (err: any) {
            setError(err.message || "Error al crear el proveedor");
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => router.back()}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Nuevo Proveedor</h1>
                    <p className="text-sm text-gray-500 mt-1">Registra una nueva empresa o contacto para tus compras.</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 flex items-center gap-3">
                    <span className="font-semibold">Error:</span> {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader
                        title="Información de la Empresa"
                        subtitle="Datos principales del proveedor."
                    />
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Nombre de la Empresa *</label>
                                <input
                                    required
                                    type="text"
                                    name="nombre"
                                    value={formData.nombre}
                                    onChange={handleChange}
                                    placeholder="Ej: Distribuidora XYZ S.A."
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Nombre del Contacto</label>
                                <input
                                    type="text"
                                    name="contacto"
                                    value={formData.contacto}
                                    onChange={handleChange}
                                    placeholder="Ej: Juan Pérez"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Email Comercial *</label>
                                <input
                                    required
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="ventas@empresa.com"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Teléfono</label>
                                <input
                                    type="tel"
                                    name="telefono"
                                    value={formData.telefono}
                                    onChange={handleChange}
                                    placeholder="+52 55 1234 5678"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Dirección Completa</label>
                            <input
                                type="text"
                                name="direccion"
                                value={formData.direccion}
                                onChange={handleChange}
                                placeholder="Av. Principal 123, Ciudad, País"
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Notas Adicionales</label>
                            <textarea
                                name="notas"
                                value={formData.notas}
                                onChange={handleChange}
                                placeholder="Condiciones de pago, horarios de entrega, etc..."
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[100px]"
                            />
                        </div>

                    </CardContent>
                </Card>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 shadow-sm"
                    >
                        {loading ? 'Guardando...' : (
                            <>
                                <Save size={18} />
                                Guardar Proveedor
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
