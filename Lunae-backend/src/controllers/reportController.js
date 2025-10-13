import { Report } from '../models/Report.js';
import { User } from '../models/Users.js';

// POST /api/users/:userId/report - Reportar un usuario
export const reportUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const reporterId = req.user.id;
    const { category, reason } = req.body;

    console.log(`📢 Usuario ${reporterId} está reportando al usuario ${userId}`);
    console.log(`📝 Categoría: ${category}, Razón: ${reason}`);

    // Validar que no se reporte a sí mismo
    if (reporterId === userId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes reportarte a ti mismo',
        error: 'SELF_REPORT'
      });
    }

    // Validar categoría
    const validCategories = ['inappropriate', 'harassment', 'spam', 'fake', 'suspicious', 'other'];
    if (!category || !validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Categoría de reporte inválida',
        error: 'INVALID_CATEGORY'
      });
    }

    // Verificar que el usuario reportado existe
    const reportedUser = await User.findById(userId);
    if (!reportedUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario reportado no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    // Verificar si ya existe un reporte del mismo usuario
    const existingReports = await Report.findByReporter(reporterId);
    const alreadyReported = existingReports.some(
      report => report.reportedUserId === userId && report.status === 'pending'
    );

    if (alreadyReported) {
      return res.status(400).json({
        success: false,
        message: 'Ya has reportado a este usuario',
        error: 'ALREADY_REPORTED'
      });
    }

    // Crear el reporte
    const report = await Report.create({
      reporterId,
      reportedUserId: userId,
      category,
      reason: reason || '',
      status: 'pending'
    });

    console.log(`✅ Reporte creado exitosamente: ${report.id}`);

    res.status(201).json({
      success: true,
      message: 'Usuario reportado exitosamente',
      data: {
        reportId: report.id,
        reportedUserId: userId,
        category: report.category,
        status: report.status,
        createdAt: report.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Error reportando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'SERVER_ERROR'
    });
  }
};

// GET /api/users/:userId/reports - Obtener reportes de un usuario (solo admin)
export const getUserReports = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`📋 Obteniendo reportes del usuario ${userId}`);

    const reports = await Report.findByReportedUser(userId);

    console.log(`✅ Encontrados ${reports.length} reportes`);

    res.json({
      success: true,
      message: 'Reportes obtenidos exitosamente',
      data: {
        userId,
        reportsCount: reports.length,
        reports: reports.map(report => ({
          id: report.id,
          reporterId: report.reporterId,
          category: report.category,
          reason: report.reason,
          status: report.status,
          createdAt: report.createdAt,
          reviewedBy: report.reviewedBy,
          reviewedAt: report.reviewedAt
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo reportes del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'SERVER_ERROR'
    });
  }
};

// GET /api/reports - Obtener todos los reportes (solo admin)
export const getAllReports = async (req, res) => {
  try {
    const { status } = req.query;

    console.log('📋 Obteniendo todos los reportes');

    let reports = await Report.findAll();

    // Filtrar por estado si se proporciona
    if (status) {
      reports = reports.filter(report => report.status === status);
    }

    console.log(`✅ Encontrados ${reports.length} reportes`);

    res.json({
      success: true,
      message: 'Reportes obtenidos exitosamente',
      data: {
        reportsCount: reports.length,
        reports: reports.map(report => ({
          id: report.id,
          reporterId: report.reporterId,
          reportedUserId: report.reportedUserId,
          category: report.category,
          reason: report.reason,
          status: report.status,
          createdAt: report.createdAt,
          reviewedBy: report.reviewedBy,
          reviewedAt: report.reviewedAt
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo todos los reportes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'SERVER_ERROR'
    });
  }
};

// POST /api/users/:userId/block - Bloquear un usuario
export const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const blockerId = req.user.id;

    console.log(`🚫 Usuario ${blockerId} está bloqueando al usuario ${userId}`);

    // Validar que no se bloquee a sí mismo
    if (blockerId === userId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes bloquearte a ti mismo',
        error: 'SELF_BLOCK'
      });
    }

    // Verificar que el usuario a bloquear existe
    const userToBlock = await User.findById(userId);
    if (!userToBlock) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    // Aquí crearías un registro de bloqueo en la base de datos
    // Por ahora, solo guardamos la acción como un reporte especial
    await Report.create({
      reporterId: blockerId,
      reportedUserId: userId,
      category: 'blocked',
      reason: 'Usuario bloqueado',
      status: 'resolved'
    });

    console.log(`✅ Usuario ${userId} bloqueado exitosamente por ${blockerId}`);

    res.json({
      success: true,
      message: 'Usuario bloqueado exitosamente',
      data: {
        blockedUserId: userId
      }
    });
  } catch (error) {
    console.error('❌ Error bloqueando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'SERVER_ERROR'
    });
  }
};



