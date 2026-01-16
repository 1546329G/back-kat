const { getPool } = require("../config/db");
const { logActivity } = require("../utils/logActivity");

const validateCitaData = (data) => {
    const errors = [];

    if (!data.dniPaciente || data.dniPaciente.length !== 8) {
        errors.push("DNI del paciente debe tener 8 dígitos");
    }

    if (!data.idDoctor) errors.push("ID del doctor es requerido");
    if (!data.fecha) errors.push("Fecha es requerida");
    if (!data.hora) errors.push("Hora es requerida");

    const citaDate = new Date(`${data.fecha}T${data.hora}`);
    if (citaDate <= new Date()) {
        errors.push("La cita debe ser programada para una fecha/hora futura");
    }

    return errors;
};

exports.createCita = async (req, res) => {
    const pool = getPool();
    const { dniPaciente, idDoctor, fecha, hora, servicio } = req.body;

    const validationErrors = validateCitaData(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ error: validationErrors.join(", ") });
    }

    try {
        const [patientRows] = await pool.execute(
            "SELECT ID_FICHA_CLINICA, NOMBRE_APELLIDO FROM FICHA_CLINICA WHERE DNI = ?",
            [dniPaciente]
        );

        if (patientRows.length === 0) {
            return res.status(404).json({
                error: "Paciente no encontrado. Registre la filiación primero.",
            });
        }

        const [doctorRows] = await pool.execute(
            "SELECT ID_USUARIO, NOMBRE, APELLIDO FROM USUARIOS WHERE ID_USUARIO = ? AND CARGO = 'doctor' AND ESTADO = 1",
            [idDoctor]
        );

        if (doctorRows.length === 0) {
            return res
                .status(404)
                .json({ error: "Doctor no encontrado o no activo." });
        }

        const idFichaClinica = patientRows[0].ID_FICHA_CLINICA;

        const [conflictRows] = await pool.execute(
            `SELECT ID_CITAS 
             FROM CITAS 
             WHERE ID_USUARIO = ? AND FECHA = ? AND HORA = ? AND ESTADO != 'CANCELADA'`,
            [idDoctor, fecha, hora]
        );

        if (conflictRows.length > 0) {
            return res.status(409).json({
                error: "El doctor ya tiene una cita programada en ese horario.",
            });
        }

        const [result] = await pool.execute(
            "INSERT INTO CITAS (ID_FICHA_CLINICA, ID_USUARIO, SERVICIO, FECHA, HORA, ESTADO) VALUES (?, ?, ?, ?, ?, 'PROGRAMADA')",
            [idFichaClinica, idDoctor, servicio || "CONSULTA GENERAL", fecha, hora]
        );

        await logActivity(req.user.dni, "CITA_CREATED", {
            idCita: result.insertId,
            paciente: patientRows[0].NOMBRE_APELLIDO,
            doctor: `${doctorRows[0].NOMBRE} ${doctorRows[0].APELLIDO}`,
            fecha,
            hora,
        });

        res.status(201).json({
            message: `Cita programada con éxito para ${patientRows[0].NOMBRE_APELLIDO}.`,
            idCita: result.insertId,
            paciente: patientRows[0].NOMBRE_APELLIDO,
            doctor: `${doctorRows[0].NOMBRE} ${doctorRows[0].APELLIDO}`,
            fecha,
            hora,
        });
    } catch (error) {
        console.error("Error al crear cita:", error);
        res.status(500).json({ error: "Error interno al registrar la cita." });
    }
};

exports.getTodayCita = async (req, res) => {
    const pool = getPool();
    const idDoctor = req.user.id;
    const today = new Date().toISOString().split("T")[0];

    try {
        const [citas] = await pool.execute(
            `SELECT 
                C.ID_CITAS, 
                C.FECHA, 
                C.HORA, 
                C.ESTADO, 
                C.SERVICIO,
                F.DNI AS DNI_PACIENTE, 
                F.NOMBRE_APELLIDO AS PACIENTE_NOMBRE,
                F.TELEFONO,
                TIMEDIFF(CONCAT(C.FECHA, ' ', C.HORA), NOW()) AS TIEMPO_RESTANTE
             FROM CITAS C
             JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA
             WHERE C.ID_USUARIO = ? AND C.FECHA = ?
             ORDER BY C.HORA ASC`,
            [idDoctor, today]
        );

        const citasFormateadas = citas.map((cita) => ({
            ...cita,
            ESTADO_DISPLAY: getEstadoDisplay(cita.ESTADO),
            URGENTE:
                cita.ESTADO === "PROGRAMADA" &&
                cita.TIEMPO_RESTANTE &&
                cita.TIEMPO_RESTANTE < "01:00:00",
        }));

        res.json({
            message: `Agenda de citas para hoy (${today}).`,
            total: citas.length,
            agenda: citasFormateadas,
        });
    } catch (error) {
        console.error("Error al obtener citas del día:", error);
        res.status(500).json({ error: "Error interno al consultar la agenda." });
    }
};

function getEstadoDisplay(estado) {
    const estados = {
        PROGRAMADA: "Programada",
        ATENDIDA: "Atendida",
        CANCELADA: "Cancelada",
    };
    return estados[estado] || estado;
}

exports.updateCitaStatus = async (req, res) => {
    const pool = getPool();
    const { idCita } = req.params;
    const { estado } = req.body;

    if (!idCita || !estado) {
        return res
            .status(400)
            .json({ error: "ID de cita y estado son requeridos." });
    }

    const estadosValidos = ["PROGRAMADA", "ATENDIDA", "CANCELADA"];
    if (!estadosValidos.includes(estado.toUpperCase())) {
        return res.status(400).json({
            error: "Estado no válido. Use: PROGRAMADA, ATENDIDA o CANCELADA.",
        });
    }

    try {
        const [citaRows] = await pool.execute(
            `SELECT C.*, F.NOMBRE_APELLIDO, U.NOMBRE AS DOCTOR_NOMBRE 
             FROM CITAS C
             JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA
             JOIN USUARIOS U ON C.ID_USUARIO = U.ID_USUARIO
             WHERE C.ID_CITAS = ?`,
            [idCita]
        );

        if (citaRows.length === 0) {
            return res
                .status(404)
                .json({ error: `Cita con ID ${idCita} no encontrada.` });
        }

        const [result] = await pool.execute(
            "UPDATE CITAS SET ESTADO = ? WHERE ID_CITAS = ?",
            [estado.toUpperCase(), idCita]
        );

        if (result.affectedRows === 0) {
            return res
                .status(404)
                .json({ error: "Cita no encontrada para actualizar." });
        }

        await logActivity(req.user.dni, "CITA_STATUS_UPDATED", {
            idCita,
            estadoAnterior: citaRows[0].ESTADO,
            estadoNuevo: estado.toUpperCase(),
            paciente: citaRows[0].NOMBRE_APELLIDO,
        });

        res.status(200).json({
            message: `Estado de la cita actualizado a '${getEstadoDisplay(
                estado.toUpperCase()
            )}'.`,
            affectedRows: result.affectedRows,
            paciente: citaRows[0].NOMBRE_APELLIDO,
        });
    } catch (error) {
        console.error("Error al actualizar estado de cita:", error);
        res.status(500).json({ error: "Error interno al actualizar el estado." });
    }
};

exports.editCita = async (req, res) => {
    const pool = getPool();
    const { idCita } = req.params;
    const { idDoctor, fecha, hora, servicio, estado } = req.body;

    if (!idCita) {
        return res.status(400).json({ error: "ID de cita es requerido." });
    }

    if (!idDoctor && !fecha && !hora && !servicio && !estado) {
        return res
            .status(400)
            .json({ error: "Se requiere al menos un campo para actualizar." });
    }

    try {
        const [citaActualRows] = await pool.execute(
            `SELECT C.*, F.NOMBRE_APELLIDO AS PACIENTE_NOMBRE, 
                    CONCAT(U.NOMBRE, ' ', U.APELLIDO) AS DOCTOR_ACTUAL
             FROM CITAS C
             JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA
             JOIN USUARIOS U ON C.ID_USUARIO = U.ID_USUARIO
             WHERE C.ID_CITAS = ?`,
            [idCita]
        );

        if (citaActualRows.length === 0) {
            return res
                .status(404)
                .json({ error: `Cita con ID ${idCita} no encontrada.` });
        }

        const citaActual = citaActualRows[0];

        const updates = [];
        const values = [];
        const cambios = [];

        if (idDoctor) {
            const [doctorRows] = await pool.execute(
                "SELECT ID_USUARIO, CONCAT(NOMBRE, ' ', APELLIDO) AS NOMBRE_COMPLETO FROM USUARIOS WHERE ID_USUARIO = ? AND CARGO = 'doctor' AND ESTADO = 1",
                [idDoctor]
            );

            if (doctorRows.length === 0) {
                return res
                    .status(404)
                    .json({ error: "Doctor no encontrado o no activo." });
            }

            updates.push("ID_USUARIO = ?");
            values.push(idDoctor);
            cambios.push(
                `doctor: ${citaActual.DOCTOR_ACTUAL} → ${doctorRows[0].NOMBRE_COMPLETO}`
            );
        }

        if (fecha && hora) {
            const nuevaFechaHora = new Date(`${fecha}T${hora}`);

            if (nuevaFechaHora <= new Date()) {
                return res.status(400).json({
                    error: "La cita debe ser programada para fecha/hora futura.",
                });
            }

            const doctorId = idDoctor || citaActual.ID_USUARIO;
            const [conflictRows] = await pool.execute(
                `SELECT ID_CITAS 
                 FROM CITAS 
                 WHERE ID_USUARIO = ? AND FECHA = ? AND HORA = ? 
                 AND ID_CITAS != ? AND ESTADO != 'CANCELADA'`,
                [doctorId, fecha, hora, idCita]
            );

            if (conflictRows.length > 0) {
                return res.status(409).json({
                    error: "Ya existe una cita programada en ese horario para el doctor.",
                });
            }

            updates.push("FECHA = ?");
            values.push(fecha);
            updates.push("HORA = ?");
            values.push(hora);
            cambios.push(
                `fecha/hora: ${citaActual.FECHA} ${citaActual.HORA} → ${fecha} ${hora}`
            );
        } else if (fecha || hora) {
            return res.status(400).json({
                error:
                    "Fecha y hora deben ser proporcionadas juntas para evitar inconsistencias.",
            });
        }

        if (servicio) {
            updates.push("SERVICIO = ?");
            values.push(servicio);
            cambios.push(`servicio: ${citaActual.SERVICIO} → ${servicio}`);
        }

        if (estado) {
            const estadosValidos = ["PROGRAMADA", "ATENDIDA", "CANCELADA"];
            if (!estadosValidos.includes(estado.toUpperCase())) {
                return res.status(400).json({
                    error: "Estado no válido. Use: PROGRAMADA, ATENDIDA o CANCELADA.",
                });
            }
            updates.push("ESTADO = ?");
            values.push(estado.toUpperCase());
            cambios.push(`estado: ${citaActual.ESTADO} → ${estado.toUpperCase()}`);
        }

        values.push(idCita);

        const [result] = await pool.execute(
            `UPDATE CITAS SET ${updates.join(", ")} WHERE ID_CITAS = ?`,
            values
        );

        if (result.affectedRows === 0) {
            return res
                .status(404)
                .json({ error: "Cita no encontrada para actualizar." });
        }

        const [citaActualizadaRows] = await pool.execute(
            `SELECT C.*, F.NOMBRE_APELLIDO, CONCAT(U.NOMBRE, ' ', U.APELLIDO) AS DOCTOR
             FROM CITAS C
             JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA
             JOIN USUARIOS U ON C.ID_USUARIO = U.ID_USUARIO
             WHERE C.ID_CITAS = ?`,
            [idCita]
        );

        await logActivity(req.user.dni, "CITA_UPDATED", {
            idCita,
            paciente: citaActual.PACIENTE_NOMBRE,
            cambios: cambios.join(", "),
            usuario: req.user.dni,
        });

        res.status(200).json({
            message: `Cita actualizada con éxito.`,
            affectedRows: result.affectedRows,
            cambios: cambios,
            cita: citaActualizadaRows[0],
        });
    } catch (error) {
        console.error("Error al editar cita:", error);

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return res
                .status(400)
                .json({ error: "Referencia inválida (doctor o paciente no existe)." });
        }

        res.status(500).json({ error: "Error interno al actualizar la cita." });
    }
};

exports.deleteCita = async (req, res) => {
    const pool = getPool();
    const { idCita } = req.params;

    if (!idCita) {
        return res.status(400).json({ error: "ID de cita es requerido." });
    }

    try {
        const [citaRows] = await pool.execute(
            `SELECT C.*, F.NOMBRE_APELLIDO, CONCAT(U.NOMBRE, ' ', U.APELLIDO) AS DOCTOR
             FROM CITAS C
             JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA
             JOIN USUARIOS U ON C.ID_USUARIO = U.ID_USUARIO
             WHERE C.ID_CITAS = ?`,
            [idCita]
        );

        if (citaRows.length === 0) {
            return res
                .status(404)
                .json({ error: `Cita con ID ${idCita} no encontrada.` });
        }

        const citaInfo = citaRows[0];

        if (citaInfo.ESTADO === "ATENDIDA") {
            return res.status(400).json({
                error: "No se puede eliminar una cita que ya fue atendida.",
            });
        }

        if (citaInfo.ESTADO === "PROGRAMADA") {
            const citaDateTime = new Date(`${citaInfo.FECHA}T${citaInfo.HORA}`);
            const ahora = new Date();
            const diferenciaHoras = (citaDateTime - ahora) / (1000 * 60 * 60);

            if (diferenciaHoras < 2 && diferenciaHoras > 0) {
                return res.status(400).json({
                    error:
                        "No se pueden eliminar citas programadas con menos de 2 horas de anticipación.",
                });
            }
        }

        const [result] = await pool.execute(
            "DELETE FROM CITAS WHERE ID_CITAS = ?",
            [idCita]
        );

        if (result.affectedRows === 0) {
            return res
                .status(404)
                .json({ error: "Cita no encontrada para eliminar." });
        }

        await logActivity(req.user.dni, "CITA_DELETED", {
            idCita,
            paciente: citaInfo.NOMBRE_APELLIDO,
            doctor: citaInfo.DOCTOR,
            fecha: citaInfo.FECHA,
            hora: citaInfo.HORA,
            estado: citaInfo.ESTADO,
            eliminadoPor: req.user.dni,
        });

        res.status(200).json({
            message: `Cita eliminada con éxito.`,
            affectedRows: result.affectedRows,
            citaEliminada: {
                id: idCita,
                paciente: citaInfo.NOMBRE_APELLIDO,
                fecha: citaInfo.FECHA,
                hora: citaInfo.HORA,
                estado: citaInfo.ESTADO,
            },
        });
    } catch (error) {
        console.error("Error al eliminar cita:", error);

        if (error.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(400).json({
                error:
                    "No se puede eliminar la cita porque tiene registros relacionados (consultas, etc.).",
            });
        }

        res.status(500).json({ error: "Error interno al eliminar la cita." });
    }
};

exports.getAllCitas = async (req, res) => {
    const pool = getPool();
    const { fecha, estado, idDoctor } = req.query;

    try {
        let whereConditions = [];
        let params = [];

        if (fecha) {
            whereConditions.push("C.FECHA = ?");
            params.push(fecha);
        }

        if (estado) {
            whereConditions.push("C.ESTADO = ?");
            params.push(estado.toUpperCase());
        }

        if (idDoctor) {
            whereConditions.push("C.ID_USUARIO = ?");
            params.push(idDoctor);
        }

        const whereClause =
            whereConditions.length > 0
                ? `WHERE ${whereConditions.join(" AND ")}`
                : "";

        const [citas] = await pool.execute(
            `SELECT 
                C.ID_CITAS,
                C.FECHA,
                C.HORA,
                C.ESTADO,
                C.SERVICIO,
                F.DNI AS DNI_PACIENTE,
                F.NOMBRE_APELLIDO AS PACIENTE_NOMBRE,
                F.TELEFONO,
                U.ID_USUARIO AS ID_DOCTOR,
                CONCAT(U.NOMBRE, ' ', U.APELLIDO) AS DOCTOR,
                CASE 
                    WHEN C.FECHA < CURDATE() THEN 'PASADA'
                    WHEN C.FECHA = CURDATE() THEN 'HOY'
                    ELSE 'FUTURA'
                END AS TIPO_FECHA
            FROM CITAS C
            JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA
            JOIN USUARIOS U ON C.ID_USUARIO = U.ID_USUARIO
            ${whereClause}
            ORDER BY C.FECHA DESC, C.HORA ASC`,
            params
        );

        res.json({
            message: "Lista de citas recuperada con éxito.",
            total: citas.length,
            filtros: { fecha, estado, idDoctor },
            citas: citas,
        });
    } catch (error) {
        console.error("Error al obtener citas:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

exports.getCitasByDoctor = async (req, res) => {
    const pool = getPool();
    const { idDoctor } = req.params;
    const { fecha, estado } = req.query;

    if (!idDoctor) {
        return res.status(400).json({ error: "ID de doctor es requerido." });
    }

    try {
        let whereConditions = ["C.ID_USUARIO = ?"];
        let params = [idDoctor];

        if (fecha) {
            whereConditions.push("C.FECHA = ?");
            params.push(fecha);
        }

        if (estado) {
            whereConditions.push("C.ESTADO = ?");
            params.push(estado.toUpperCase());
        }

        const [citas] = await pool.execute(
            `SELECT 
                C.ID_CITAS,
                C.FECHA,
                C.HORA,
                C.ESTADO,
                C.SERVICIO,
                F.DNI,
                F.NOMBRE_APELLIDO AS PACIENTE,
                F.TELEFONO,
                CONCAT(U.NOMBRE, ' ', U.APELLIDO) AS DOCTOR
             FROM CITAS C
             JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA
             JOIN USUARIOS U ON C.ID_USUARIO = U.ID_USUARIO
             WHERE ${whereConditions.join(" AND ")}
             ORDER BY C.FECHA DESC, C.HORA ASC`,
            params
        );

        res.json({
            message: `Citas del doctor recuperadas con éxito.`,
            total: citas.length,
            doctor: citas[0]?.DOCTOR || "No encontrado",
            filtros: { fecha, estado },
            citas: citas,
        });
    } catch (error) {
        console.error("Error al obtener citas por doctor:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

exports.getCitasByPaciente = async (req, res) => {
    const pool = getPool();
    const { dniPaciente } = req.params;
    const { estado } = req.query;

    if (!dniPaciente) {
        return res.status(400).json({ error: "DNI del paciente es requerido." });
    }

    try {
        const [pacienteRows] = await pool.execute(
            "SELECT NOMBRE_APELLIDO FROM FICHA_CLINICA WHERE DNI = ?",
            [dniPaciente]
        );

        if (pacienteRows.length === 0) {
            return res.status(404).json({ error: "Paciente no encontrado." });
        }

        let whereConditions = ["F.DNI = ?"];
        let params = [dniPaciente];

        if (estado) {
            whereConditions.push("C.ESTADO = ?");
            params.push(estado.toUpperCase());
        }

        const [citas] = await pool.execute(
            `SELECT 
                C.ID_CITAS,
                C.FECHA,
                C.HORA,
                C.ESTADO,
                C.SERVICIO,
                F.DNI,
                F.NOMBRE_APELLIDO AS PACIENTE,
                CONCAT(U.NOMBRE, ' ', U.APELLIDO) AS DOCTOR,
                U.ID_USUARIO AS ID_DOCTOR
             FROM CITAS C
             JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA
             JOIN USUARIOS U ON C.ID_USUARIO = U.ID_USUARIO
             WHERE ${whereConditions.join(" AND ")}
             ORDER BY C.FECHA DESC, C.HORA ASC`,
            params
        );

        res.json({
            message: `Citas del paciente recuperadas con éxito.`,
            total: citas.length,
            paciente: pacienteRows[0].NOMBRE_APELLIDO,
            dni: dniPaciente,
            filtros: { estado },
            citas: citas,
        });
    } catch (error) {
        console.error("Error al obtener citas por paciente:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

exports.getProximasCitas = async (req, res) => {
    const pool = getPool();
    const { dias = 7 } = req.query;

    try {
        const fechaFin = new Date();
        fechaFin.setDate(fechaFin.getDate() + parseInt(dias));

        const [citas] = await pool.execute(
            `SELECT 
                C.ID_CITAS,
                C.FECHA,
                C.HORA,
                C.ESTADO,
                C.SERVICIO,
                F.DNI,
                F.NOMBRE_APELLIDO AS PACIENTE,
                F.TELEFONO,
                CONCAT(U.NOMBRE, ' ', U.APELLIDO) AS DOCTOR,
                DATEDIFF(C.FECHA, CURDATE()) AS DIAS_RESTANTES
             FROM CITAS C
             JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA
             JOIN USUARIOS U ON C.ID_USUARIO = U.ID_USUARIO
             WHERE C.FECHA BETWEEN CURDATE() AND ?
             AND C.ESTADO = 'PROGRAMADA'
             ORDER BY C.FECHA ASC, C.HORA ASC`,
            [fechaFin.toISOString().split("T")[0]]
        );

        res.json({
            message: `Citas próximas (próximos ${dias} días) recuperadas con éxito.`,
            total: citas.length,
            periodo: `${new Date().toISOString().split("T")[0]} a ${fechaFin.toISOString().split("T")[0]
                }`,
            citas: citas,
        });
    } catch (error) {
        console.error("Error al obtener citas próximas:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};