#cmake_minimum_required(VERSION 3.10.2)
#project("llama_jni")
#
## Specify your llama native library path if not built inside this project
#set(llama_lib_path "${CMAKE_SOURCE_DIR}/../jniLibs/arm64-v8a")
#
#add_library(llama SHARED IMPORTED)
#set_target_properties(llama PROPERTIES IMPORTED_LOCATION
#        "${llama_lib_path}/libllama.so"
#)
#
## Build your JNI bridge library
#add_library(
#        llama_jni
#        SHARED
#        llama_jni.cpp
#)
#
#find_library(log-lib log)
#
#target_link_libraries(
#        llama_jni
#        llama               # Link your llama native library
#        ${log-lib}          # Android log library
#)
