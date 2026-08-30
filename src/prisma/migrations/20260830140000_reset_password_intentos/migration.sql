-- Contador de intentos fallidos del codigo OTP de recuperacion. Tras varios
-- fallos el codigo se invalida para no dejar fuerza bruta sobre los 6 digitos.
ALTER TABLE "Usuario" ADD COLUMN "resetPasswordIntentos" INTEGER NOT NULL DEFAULT 0;
