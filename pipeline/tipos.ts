/** Tipos compartidos del pipeline del empleado IA. */

export type Pilar = "Fe" | "Virtud" | "Deber" | "Familia";
import type { DireccionVisual } from "./direccion-visual.js";

export interface TemaBacklog {
  n: number;
  id: string;
  titulo: string;
  pilar: Pilar;
  categoria: string;
  formato: "carrusel" | "cita";
  sensible: boolean;
  nivel: string;
  santos: string[];
  fuentes_sugeridas: string[];
  estado: string; // backlog | seleccionado | generado | en_revision | aprobado | descartado | programado | publicado
}

export interface Backlog {
  descripcion?: string;
  temas: TemaBacklog[];
}

export interface RegistroPieza {
  id: string;
  tema: string;
  pilar: Pilar;
  santos: string[];
  formato: string;
  fuentes: string[]; // ids de ficha citadas
  gancho?: string;
  nivel?: string;
  fecha: string; // fecha de generación (ISO)
  estado: string;
  resultado?: string;
  direccion_visual?: DireccionVisual;
}

export interface Registro {
  descripcion?: string;
  piezas: RegistroPieza[];
}

/** Balde de la distribución editorial objetivo. */
export type Balde =
  | "formacion"
  | "virtudes-vida-espiritual"
  | "familia"
  | "santos-fuentes-libros"
  | "comunidad";

export const OBJETIVO_DISTRIBUCION: Record<Balde, number> = {
  formacion: 0.35,
  "virtudes-vida-espiritual": 0.25,
  familia: 0.2,
  "santos-fuentes-libros": 0.15,
  comunidad: 0.05,
};

/** Mapea la categoría de un tema al balde de distribución. */
export function baldeDe(categoria: string): Balde {
  switch (categoria) {
    case "formacion":
      return "formacion";
    case "virtudes":
    case "vida-espiritual":
    case "pureza":
      return "virtudes-vida-espiritual";
    case "noviazgo":
    case "matrimonio":
    case "paternidad":
      return "familia";
    case "santos":
      return "santos-fuentes-libros";
    case "comunidad":
      return "comunidad";
    default:
      return "formacion";
  }
}
