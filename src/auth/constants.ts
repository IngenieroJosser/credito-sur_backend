export const jwtConstants = {
  // Getter, no valor: si se lee al importar el modulo, el .env todavia no
  // esta cargado y el secreto queda undefined.
  get secret(): string {
    return process.env.JWT_SECRET as string;
  },
};
