const base = require('./app.json');

const roleConfigs = {
  driver: {
    androidPackage: 'com.shiiedu.driver',
    backgroundColor: '#FFF7E6',
    icon: './assets/images/icon-driver.png',
    name: 'Shii-Edu Driver',
    role: 'driver',
    scheme: 'shiiedudriver',
    slug: 'shii-edu-driver',
  },
  institute: {
    androidPackage: 'com.shiiedu.institute',
    backgroundColor: '#F2F1FF',
    icon: './assets/images/icon-institute.png',
    name: 'Shii-Edu Institute',
    role: 'institute',
    scheme: 'shiieduinstitute',
    slug: 'shii-edu-institute',
  },
  parents: {
    androidPackage: 'com.shiiedu.parents',
    backgroundColor: '#EAFBF4',
    icon: './assets/images/icon-parents.png',
    name: 'Shii-Edu Parents',
    role: 'parent',
    scheme: 'shiieduparents',
    slug: 'shii-edu-parents',
  },
  superadmin: {
    androidPackage: 'com.shiiedu.superadmin',
    backgroundColor: '#02030A',
    icon: './assets/images/icon.png',
    name: 'Shii-Edu Superadmin',
    role: 'superadmin',
    scheme: 'shiiedusuperadmin',
    slug: 'shii-edu-superadmin',
  },
};

const normalizeRole = (value) => {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'driver') return 'driver';
  if (role === 'parent' || role === 'parents') return 'parents';
  if (role === 'superadmin' || role === 'super-admin') return 'superadmin';
  return 'institute';
};

const getAndroidPermissions = (role) => {
  if (role === 'driver') {
    return [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
    ];
  }

  if (role === 'institute' || role === 'superadmin') {
    return [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'READ_MEDIA_IMAGES',
      'READ_MEDIA_VIDEO',
    ];
  }

  return [];
};

const LOCATION_PERMISSIONS = [
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
];

const MEDIA_PERMISSIONS = [
  'android.permission.CAMERA',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
];

const getAndroidBlockedPermissions = (role) => {
  if (role === 'driver') {
    return MEDIA_PERMISSIONS;
  }

  if (role === 'institute' || role === 'superadmin') {
    return LOCATION_PERMISSIONS;
  }

  return [...LOCATION_PERMISSIONS, ...MEDIA_PERMISSIONS];
};

module.exports = () => {
  const roleKey = normalizeRole(process.env.SHII_EDU_APP_ROLE || process.env.EXPO_PUBLIC_LOCKED_ROLE);
  const roleConfig = roleConfigs[roleKey];
  const expo = base.expo;
  const plugins = (expo.plugins || []).filter((plugin) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    return roleKey === 'driver' || pluginName !== 'expo-location';
  });
  const infoPlist = {
    ...(expo.ios?.infoPlist || {}),
  };
  if (roleKey !== 'driver') {
    delete infoPlist.NSLocationWhenInUseUsageDescription;
  }

  return {
    ...expo,
    android: {
      ...expo.android,
      adaptiveIcon: {
        backgroundColor: roleConfig.backgroundColor,
        foregroundImage: './assets/images/android-icon-foreground.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      package: roleConfig.androidPackage,
      blockedPermissions: getAndroidBlockedPermissions(roleKey),
      permissions: getAndroidPermissions(roleKey),
    },
    extra: {
      ...(expo.extra || {}),
      lockedRole: roleConfig.role,
    },
    icon: roleConfig.icon,
    ios: {
      ...expo.ios,
      bundleIdentifier: roleConfig.androidPackage,
      infoPlist,
    },
    name: roleConfig.name,
    plugins,
    scheme: roleConfig.scheme,
    slug: roleConfig.slug,
  };
};
