#include <jni.h>
#include <string>

// Include llama headers if needed
// #include "llama.h"

extern "C" {

// Example native function that calls some llama function
JNIEXPORT jstring JNICALL
java_com_voiceassistant_model_LlamaNative_getLlamaVersion(JNIEnv* env, jobject /* this */) {
    std::string version = "llama version 0.1";  // Replace with actual llama call
    return env->NewStringUTF(version.c_str());
}

}
