#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// ObjC bridge — tells Capacitor's runtime about VisionPlugin and its exported method.
CAP_PLUGIN(VisionPlugin, "VisionPlugin",
    CAP_PLUGIN_METHOD(analyzeImage, CAPPluginReturnPromise);
)
